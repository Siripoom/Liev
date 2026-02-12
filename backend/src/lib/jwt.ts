import jwt from 'jsonwebtoken';
import type { AdminRole } from '@prisma/client';
import { env } from '../config/env.js';

export type ViewerTokenPayload = {
  eventId: string;
  sessionId: string;
  codeId: string;
  code: string;
};

export type AdminTokenPayload = {
  adminId: string;
  role: AdminRole;
};

export function signViewerToken(payload: ViewerTokenPayload): string {
  return jwt.sign(payload, env.JWT_VIEWER_SECRET, {
    expiresIn: env.VIEWER_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyViewerToken(token: string): ViewerTokenPayload {
  return jwt.verify(token, env.JWT_VIEWER_SECRET) as ViewerTokenPayload;
}

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.JWT_ADMIN_SECRET, {
    expiresIn: env.ADMIN_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.JWT_ADMIN_SECRET) as AdminTokenPayload;
}
