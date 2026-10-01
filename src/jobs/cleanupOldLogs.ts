import { prisma } from '../config/database';
import { logger } from '../config/logger';

/** Delete audit logs older than 180 days. Adjust per your retention policy. */
export async function cleanupOldLogs() {
  const cutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const result = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  logger.info(`Audit log cleanup: deleted ${result.count}`);
}
