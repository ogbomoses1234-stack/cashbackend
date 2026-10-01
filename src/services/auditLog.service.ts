import { prisma } from '../config/database';
import { logger } from '../config/logger';
import type { Role } from '../types';

export class AuditLogService {
  static async record(opts: {
    actorId?: string;
    actorRole?: Role;
    event: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    fingerprint?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: opts.actorId,
          actorRole: opts.actorRole as any,
          event: opts.event,
          entityType: opts.entityType,
          entityId: opts.entityId,
          ipAddress: opts.ipAddress,
          fingerprint: opts.fingerprint,
          details: (opts.details ?? undefined) as any,
        },
      });
    } catch (err) {
      logger.warn('Audit log write failed', err);
    }
  }
}
