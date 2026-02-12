import { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';
import { verifyAdminToken, verifyViewerToken } from '../lib/jwt.js';

export function requireViewerAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies.viewer_token as string | undefined;
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Viewer authentication required'));
    return;
  }

  try {
    req.viewer = verifyViewerToken(token);
    next();
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Invalid viewer token'));
  }
}

export function requireAdminAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies.admin_token as string | undefined;
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Admin authentication required'));
    return;
  }

  try {
    req.admin = verifyAdminToken(token);
    if (req.admin.role !== 'admin') {
      next(new AppError(403, 'FORBIDDEN', 'Admin role required'));
      return;
    }
    next();
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Invalid admin token'));
  }
}
