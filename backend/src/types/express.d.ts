import type { AdminRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      viewer?: {
        eventId: string;
        sessionId: string;
        codeId: string;
        code: string;
      };
      admin?: {
        adminId: string;
        role: AdminRole;
      };
    }
  }
}

export {};
