import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { adminRedis } from '../config/redis';
import { ApiError } from '../utils/ApiError';
import type { AdminPayload } from '../types';

function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.ip || '';
}

export async function adminAuthenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
    req.cookies?.adminAccessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);
    if (!token) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin auth required');

    const payload = jwt.verify(token, config.jwt.adminSecret) as AdminPayload;

    const reqIp = clientIp(req);
    if (payload.ip && payload.ip !== reqIp) {
      throw ApiError.unauthorized('IP_MISMATCH', 'Session IP changed — re-login required');
    }

    const sessionAlive = await adminRedis.get(`admin_session:${payload.sub}`);
    if (!sessionAlive || sessionAlive !== payload.sessionId) {
      throw ApiError.unauthorized('SESSION_EXPIRED', 'Session ended. Re-login.');
    }

    req.admin = payload;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(ApiError.unauthorized('ADMIN_TOKEN_INVALID', 'Invalid admin token'));
  }
}
