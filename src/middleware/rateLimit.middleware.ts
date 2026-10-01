import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { ApiError } from '../utils/ApiError';

export function rateLimit(opts: {
  keyPrefix: string;
  maxHits: number;
  windowSecs: number;
  by?: (req: Request) => string;
}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const id =
        opts.by?.(req) ||
        req.user?.sub ||
        req.admin?.sub ||
        req.ip ||
        'anon';

      const key = `${opts.keyPrefix}:${id}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, opts.windowSecs);

      if (count > opts.maxHits) {
        throw ApiError.tooMany('RATE_LIMITED', 'Too many requests. Try again later.');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Scan speed limiter with distinct lockout key (longer block after breach). */
export async function checkScanRate(userId: string, maxHits: number, lockoutSecs: number) {
  const lockKey = `scan_lock:${userId}`;
  if (await redis.get(lockKey)) {
    throw ApiError.tooMany('SCAN_LIMIT_EXCEEDED', 'Too many scans. Wait before retrying.');
  }

  const key = `scan_rate:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);

  if (count > maxHits) {
    await redis.set(lockKey, '1', 'EX', lockoutSecs);
    throw ApiError.tooMany('SCAN_LIMIT_EXCEEDED', 'Too many scans. Wait before retrying.');
  }
}
