import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import type { Role } from '../types';

export const requireRole =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(ApiError.unauthorized());
    if (!allowed.includes(user.role)) {
      return next(ApiError.forbidden('ROLE_FORBIDDEN', 'You do not have permission'));
    }
    next();
  };

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.admin) return next(ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required'));
  next();
};
