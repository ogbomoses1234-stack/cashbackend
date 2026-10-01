import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  (req as any).id = typeof incoming === 'string' && incoming ? incoming : randomUUID();
  res.setHeader('X-Request-Id', (req as any).id);
  next();
}
