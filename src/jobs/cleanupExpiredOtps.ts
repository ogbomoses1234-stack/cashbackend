import { prisma } from '../config/database';
import { logger } from '../config/logger';

/** Delete OTP tokens that expired more than 24h ago. */
export async function cleanupExpiredOtps() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.otpToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  logger.info(`OTP cleanup: deleted ${result.count}`);
}
