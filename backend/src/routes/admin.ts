import { EventStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import { signAdminToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import { generateAccessCode } from '../utils/code.js';

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createEventBodySchema = z.object({
  title: z.string().min(1),
  status: z.nativeEnum(EventStatus).optional(),
  hlsPath: z.string().optional(),
});

const patchEventBodySchema = z.object({
  title: z.string().min(1).optional(),
  status: z.nativeEnum(EventStatus).optional(),
  hlsPath: z.string().optional(),
});

const bulkCodesSchema = z.object({
  eventId: z.string().min(1),
  quantity: z.number().int().min(1).max(10000),
  expiresAt: z.string().datetime().optional(),
  maxUses: z.number().int().min(1).optional(),
  oneTime: z.boolean().optional(),
});

const adminCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN || undefined,
  path: '/',
};

function escapeCsvValue(value: string | number | boolean | null): string {
  if (value === null) {
    return '';
  }

  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

async function generateCodesForEvent(params: {
  eventId: string;
  quantity: number;
  expiresAt: Date | null;
  maxUses: number;
  oneTime: boolean;
}): Promise<string[]> {
  const inserted = new Set<string>();
  let attempts = 0;

  while (inserted.size < params.quantity) {
    attempts += 1;
    if (attempts > 30) {
      throw new AppError(500, 'CODE_GENERATION_FAILED', 'Unable to generate unique codes');
    }

    const needed = params.quantity - inserted.size;
    const poolTarget = Math.max(needed * 3, 64);
    const candidates = new Set<string>();

    while (candidates.size < poolTarget) {
      const code = generateAccessCode();
      if (!inserted.has(code)) {
        candidates.add(code);
      }
    }

    const candidateArray = Array.from(candidates);
    const existing = await prisma.accessCode.findMany({
      where: { code: { in: candidateArray } },
      select: { code: true },
    });

    const existingSet = new Set(existing.map((row) => row.code));
    const toInsert: string[] = [];

    for (const code of candidateArray) {
      if (!existingSet.has(code) && !inserted.has(code)) {
        toInsert.push(code);
      }
      if (toInsert.length >= needed) {
        break;
      }
    }

    if (toInsert.length === 0) {
      continue;
    }

    await prisma.accessCode.createMany({
      data: toInsert.map((code) => ({
        code,
        eventId: params.eventId,
        expiresAt: params.expiresAt,
        maxUses: params.oneTime ? 1 : params.maxUses,
        isOneTime: params.oneTime,
      })),
      skipDuplicates: true,
    });

    const persisted = await prisma.accessCode.findMany({
      where: {
        eventId: params.eventId,
        code: { in: toInsert },
      },
      select: { code: true },
    });

    for (const row of persisted) {
      inserted.add(row.code);
      if (inserted.size >= params.quantity) {
        break;
      }
    }
  }

  return Array.from(inserted);
}

export const adminRouter = Router();

adminRouter.post('/auth/login', async (req, res, next) => {
  try {
    const body = loginBodySchema.parse(req.body);

    const admin = await prisma.admin.findUnique({
      where: { email: body.email },
    });

    if (!admin) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const validPassword = await bcrypt.compare(body.password, admin.passwordHash);
    if (!validPassword) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const token = signAdminToken({
      adminId: admin.id,
      role: admin.role,
    });

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await logAudit({
      actorAdminId: admin.id,
      action: 'ADMIN_LOGIN',
      targetType: 'admin',
      targetId: admin.id,
    });

    res.cookie('admin_token', token, adminCookieOptions);
    res.json({ adminId: admin.id, role: admin.role });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/auth/logout', requireAdminAuth, async (req, res, next) => {
  try {
    await logAudit({
      actorAdminId: req.admin?.adminId,
      action: 'ADMIN_LOGOUT',
      targetType: 'admin',
      targetId: req.admin?.adminId,
    });

    res.clearCookie('admin_token', { ...adminCookieOptions, maxAge: 0 });
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

adminRouter.use(requireAdminAuth);

adminRouter.get('/me', (req, res) => {
  res.json({
    adminId: req.admin?.adminId,
    role: req.admin?.role,
  });
});

adminRouter.get('/events', async (_req, res, next) => {
  try {
    const staleCutoff = new Date(Date.now() - env.SESSION_STALE_SECONDS * 1000);

    const [events, activeByEvent] = await Promise.all([
      prisma.event.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              accessCodes: true,
              redemptions: true,
            },
          },
        },
      }),
      prisma.viewerSession.groupBy({
        by: ['eventId'],
        where: {
          isActive: true,
          lastSeen: {
            gte: staleCutoff,
          },
        },
        _count: {
          eventId: true,
        },
      }),
    ]);

    const activeMap = new Map(activeByEvent.map((row) => [row.eventId, row._count.eventId]));

    res.json(
      events.map((event) => ({
        id: event.id,
        title: event.title,
        status: event.status,
        hlsPath: event.hlsPath,
        streamKey: event.streamKey,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
        redeemCount: event._count.redemptions,
        totalCodes: event._count.accessCodes,
        activeViewers: activeMap.get(event.id) ?? 0,
      })),
    );
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/events', async (req, res, next) => {
  try {
    const body = createEventBodySchema.parse(req.body);
    const streamKey = crypto.randomBytes(12).toString('hex');

    const event = await prisma.event.create({
      data: {
        title: body.title,
        status: body.status ?? EventStatus.draft,
        streamKey,
        hlsPath: body.hlsPath,
      },
    });

    const finalEvent = event.hlsPath
      ? event
      : await prisma.event.update({
          where: { id: event.id },
          data: {
            hlsPath: `live/${event.streamKey}/index.m3u8`,
          },
        });

    await logAudit({
      actorAdminId: req.admin?.adminId,
      action: 'EVENT_CREATE',
      targetType: 'event',
      targetId: finalEvent.id,
      metadata: {
        title: finalEvent.title,
        status: finalEvent.status,
      },
    });

    res.status(201).json(finalEvent);
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/events/:id', async (req, res, next) => {
  try {
    const body = patchEventBodySchema.parse(req.body);

    const existing = await prisma.event.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    if (existing.status === EventStatus.ended && body.status && body.status !== EventStatus.ended) {
      throw new AppError(400, 'INVALID_STATUS_TRANSITION', 'Ended events cannot be reopened');
    }

    const updated = await prisma.event.update({
      where: { id: existing.id },
      data: {
        title: body.title,
        status: body.status,
        hlsPath: body.hlsPath,
      },
    });

    await logAudit({
      actorAdminId: req.admin?.adminId,
      action: 'EVENT_UPDATE',
      targetType: 'event',
      targetId: updated.id,
      metadata: {
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/codes/bulk', async (req, res, next) => {
  try {
    const body = bulkCodesSchema.parse(req.body);

    const event = await prisma.event.findUnique({
      where: { id: body.eventId },
    });

    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    const oneTime = body.oneTime ?? true;
    const maxUses = body.maxUses ?? 1;
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const createdCodes = await generateCodesForEvent({
      eventId: body.eventId,
      quantity: body.quantity,
      expiresAt,
      maxUses,
      oneTime,
    });

    await logAudit({
      actorAdminId: req.admin?.adminId,
      action: 'CODES_BULK_CREATE',
      targetType: 'event',
      targetId: body.eventId,
      metadata: {
        quantity: body.quantity,
        oneTime,
        maxUses: oneTime ? 1 : maxUses,
      },
    });

    res.status(201).json({
      eventId: body.eventId,
      requested: body.quantity,
      created: createdCodes.length,
      oneTime,
      maxUses: oneTime ? 1 : maxUses,
      expiresAt,
      codes: createdCodes,
      csvUrl: `/api/admin/codes/export.csv?eventId=${body.eventId}`,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/codes/export.csv', async (req, res, next) => {
  try {
    const eventId = String(req.query.eventId || '');
    if (!eventId) {
      throw new AppError(400, 'INVALID_EVENT_ID', 'eventId is required');
    }

    const codes = await prisma.accessCode.findMany({
      where: { eventId },
      select: {
        code: true,
        eventId: true,
        expiresAt: true,
        maxUses: true,
        usedCount: true,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const header = ['code', 'event_id', 'expires_at', 'max_uses', 'used_count', 'is_active'];
    const lines = [header.join(',')];

    for (const row of codes) {
      lines.push(
        [
          escapeCsvValue(row.code),
          escapeCsvValue(row.eventId),
          escapeCsvValue(row.expiresAt ? row.expiresAt.toISOString() : null),
          escapeCsvValue(row.maxUses),
          escapeCsvValue(row.usedCount),
          escapeCsvValue(row.isActive),
        ].join(','),
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="codes-${eventId}.csv"`);
    res.send(lines.join('\n'));
  } catch (error) {
    next(error);
  }
});
