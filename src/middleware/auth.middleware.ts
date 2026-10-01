import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { redis } from '../config/redis';
import { ApiError } from '../utils/ApiError';
import type { AuthUserPayload } from '../types';

function extractToken(req: Request): string | null {
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized();

    const payload = jwt.verify(token, config.jwt.publicSecret) as AuthUserPayload;

    const revoked = await redis.get(`revoked:${payload.jti}`);
    if (revoked) throw ApiError.unauthorized('TOKEN_REVOKED', 'Session expired');

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    return next(ApiError.unauthorized('TOKEN_INVALID', 'Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwt.publicSecret) as AuthUserPayload;
    req.user = payload;
  } catch {
    /* ignore invalid token — treat as guest */
  }
  next();
}
