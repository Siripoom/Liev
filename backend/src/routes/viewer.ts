import { EventStatus, Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { evaluateRedeemEligibility } from '../domain/redeem-rules.js';
import { AppError } from '../lib/errors.js';
import { signViewerToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { requireViewerAuth } from '../middleware/auth.js';
import { redeemRateLimit } from '../middleware/rate-limit.js';
import { normalizeCode, isValidCodeFormat } from '../utils/code.js';
import { isStale } from '../utils/time.js';

const redeemBodySchema = z.object({
  code: z.string().min(1),
  eventId: z.string().optional(),
});

const streamQuerySchema = z.object({
  eventId: z.string().min(1),
});

const viewerCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  domain: env.COOKIE_DOMAIN || undefined,
  path: '/',
};

function buildPlaybackUrl(hlsPath: string): string {
  return `${env.STREAM_PUBLIC_BASE_URL.replace(/\/$/, '')}/${hlsPath.replace(/^\//, '')}`;
}

export const viewerRouter = Router();

viewerRouter.post('/redeem', redeemRateLimit, async (req, res, next) => {
  try {
    const body = redeemBodySchema.parse(req.body);
    const codeInput = normalizeCode(body.code);

    if (!isValidCodeFormat(codeInput)) {
      throw new AppError(400, 'INVALID_CODE_FORMAT', 'Code must match 8-char A-Z0-9');
    }

    const codeRecord = await prisma.accessCode.findUnique({
      where: { code: codeInput },
      include: {
        event: true,
      },
    });

    if (!codeRecord) {
      throw new AppError(404, 'CODE_NOT_FOUND', 'Access code not found');
    }

    if (body.eventId && codeRecord.eventId !== body.eventId) {
      throw new AppError(400, 'EVENT_MISMATCH', 'Code does not belong to event');
    }

    const codeState = evaluateRedeemEligibility({
      isActive: codeRecord.isActive,
      expiresAt: codeRecord.expiresAt,
      usedCount: codeRecord.usedCount,
      maxUses: codeRecord.maxUses,
      isOneTime: codeRecord.isOneTime,
    });

    if (!codeState.ok) {
      throw new AppError(400, codeState.reason, 'Code is not redeemable');
    }

    if (codeRecord.event.status === EventStatus.ended) {
      throw new AppError(400, 'EVENT_ENDED', 'Event has ended');
    }

    const now = new Date();

    await prisma.viewerSession.updateMany({
      where: {
        codeId: codeRecord.id,
        isActive: true,
        lastSeen: { lt: new Date(now.getTime() - env.SESSION_STALE_SECONDS * 1000) },
      },
      data: {
        isActive: false,
        terminatedReason: 'STALE_TIMEOUT_SWEEP',
      },
    });

    const activeSession = await prisma.viewerSession.findFirst({
      where: {
        codeId: codeRecord.id,
        isActive: true,
      },
      orderBy: {
        lastSeen: 'desc',
      },
    });

    if (activeSession && !isStale(activeSession.lastSeen, env.SESSION_STALE_SECONDS)) {
      throw new AppError(409, 'CODE_IN_USE', 'Access code already has an active viewer session');
    }

    const sessionId = crypto.randomUUID();

    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.accessCode.findUnique({ where: { id: codeRecord.id } });
        if (!fresh) {
          throw new AppError(404, 'CODE_NOT_FOUND', 'Access code not found');
        }

        const freshState = evaluateRedeemEligibility({
          isActive: fresh.isActive,
          expiresAt: fresh.expiresAt,
          usedCount: fresh.usedCount,
          maxUses: fresh.maxUses,
          isOneTime: fresh.isOneTime,
        });

        if (!freshState.ok) {
          throw new AppError(400, freshState.reason, 'Code is not redeemable');
        }

        await tx.accessCode.update({
          where: { id: codeRecord.id },
          data: {
            usedCount: {
              increment: 1,
            },
          },
        });

        await tx.viewerSession.create({
          data: {
            sessionId,
            eventId: codeRecord.eventId,
            codeId: codeRecord.id,
            lastSeen: now,
            isActive: true,
          },
        });

        await tx.redemption.create({
          data: {
            codeId: codeRecord.id,
            eventId: codeRecord.eventId,
            sessionId,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target).includes('viewer_sessions_active_code_unique')
      ) {
        throw new AppError(409, 'CODE_IN_USE', 'Access code already has an active viewer session');
      }

      throw error;
    }

    const token = signViewerToken({
      eventId: codeRecord.eventId,
      sessionId,
      codeId: codeRecord.id,
      code: codeRecord.code,
    });

    res.cookie('viewer_token', token, viewerCookieOptions);

    res.json({
      eventId: codeRecord.eventId,
      sessionId,
      status: codeRecord.event.status,
    });
  } catch (error) {
    next(error);
  }
});

viewerRouter.get('/stream-url', requireViewerAuth, async (req, res, next) => {
  try {
    const query = streamQuerySchema.parse(req.query);

    if (!req.viewer || req.viewer.eventId !== query.eventId) {
      throw new AppError(403, 'FORBIDDEN', 'Token does not match requested event');
    }

    const session = await prisma.viewerSession.findUnique({
      where: { sessionId: req.viewer.sessionId },
    });

    if (!session || !session.isActive) {
      throw new AppError(409, 'SESSION_TERMINATED', 'Viewer session terminated');
    }

    const event = await prisma.event.findUnique({
      where: { id: query.eventId },
    });

    if (!event) {
      throw new AppError(404, 'EVENT_NOT_FOUND', 'Event not found');
    }

    if (event.status === EventStatus.draft) {
      res.json({ playbackUrl: null, eventStatus: 'not_started' });
      return;
    }

    if (event.status === EventStatus.ended) {
      res.json({ playbackUrl: null, eventStatus: 'ended' });
      return;
    }

    const hlsPath = event.hlsPath || `live/${event.streamKey}/index.m3u8`;

    res.json({
      playbackUrl: buildPlaybackUrl(hlsPath),
      eventStatus: 'live',
    });
  } catch (error) {
    next(error);
  }
});

viewerRouter.post('/heartbeat', requireViewerAuth, async (req, res, next) => {
  try {
    if (!req.viewer) {
      throw new AppError(401, 'UNAUTHORIZED', 'Viewer authentication required');
    }

    const session = await prisma.viewerSession.findUnique({
      where: { sessionId: req.viewer.sessionId },
    });

    if (!session || !session.isActive) {
      throw new AppError(409, 'SESSION_TERMINATED', 'Viewer session terminated');
    }

    await prisma.viewerSession.update({
      where: { sessionId: req.viewer.sessionId },
      data: {
        lastSeen: new Date(),
      },
    });

    res.json({ status: 'ok', heartbeatEverySeconds: env.HEARTBEAT_SECONDS });
  } catch (error) {
    next(error);
  }
});
