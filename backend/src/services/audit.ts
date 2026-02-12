import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function logAudit(data: {
  actorAdminId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorAdminId: data.actorAdminId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      metadata: data.metadata,
    },
  });
}
