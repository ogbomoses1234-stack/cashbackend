import { Request, Response, NextFunction } from 'express';
import { AuditLogService } from '../services/auditLog.service';

/**
 * Records non-GET requests that complete successfully (2xx).
 * Fine-grained events are logged explicitly in services/controllers;
 * this middleware provides a safety net + IP capture.
 */
export function auditLog(eventName?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      if (req.method === 'GET') return;
      if (res.statusCode >= 400) return;

      AuditLogService.record({
        actorId: req.user?.sub || req.admin?.sub,
        actorRole: (req.user?.role as any) || (req.admin ? 'admin' : undefined),
        event: eventName || `${req.method.toLowerCase()}.${req.baseUrl}${req.path}`,
        ipAddress: req.ip,
        fingerprint: req.fingerprintHash,
        details: { durationMs: Date.now() - startedAt },
      }).catch(() => {});
    });
    next();
  };
}
