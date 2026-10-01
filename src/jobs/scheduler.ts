import cron from 'node-cron';
import { logger } from '../config/logger';
import { cleanupExpiredOtps } from './cleanupExpiredOtps';
import { cleanupOldLogs } from './cleanupOldLogs';
import { expirePendingWithdrawals } from './expirePendingWithdrawals';
import { cleanupOrphanedUploads } from './cleanupOrphanedUploads';

const wrap = (name: string, fn: () => Promise<void>) => async () => {
  try {
    logger.info(`⏰ Job start: ${name}`);
    await fn();
    logger.info(`✅ Job done: ${name}`);
  } catch (err) {
    logger.error(`❌ Job failed: ${name}`, err);
  }
};

export function startScheduler() {
  // Expired OTPs — every hour
  cron.schedule('0 * * * *', wrap('cleanupExpiredOtps', cleanupExpiredOtps));

  // Old audit logs — daily at 3:00 AM
  cron.schedule('0 3 * * *', wrap('cleanupOldLogs', cleanupOldLogs));

  // Stale withdrawals — daily at 4:00 AM
  cron.schedule('0 4 * * *', wrap('expirePendingWithdrawals', expirePendingWithdrawals));

  // Orphaned uploads — daily at 3:30 AM
  cron.schedule('30 3 * * *', wrap('cleanupOrphanedUploads', cleanupOrphanedUploads));

  logger.info('✅ Scheduler started');
}
