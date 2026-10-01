import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { EmailService } from '../services/email.service';

/**
 * Auto-decline withdrawal requests older than 7 days that admins never processed.
 * Returns funds to the customer's wallet.
 */
export async function expirePendingWithdrawals() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stale = await prisma.withdrawalRequest.findMany({
    where: { status: 'pending', createdAt: { lt: cutoff } },
    include: { user: true },
  });

  if (stale.length === 0) return;

  for (const req of stale) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.withdrawalRequest.update({
          where: { id: req.id },
          data: {
            status: 'declined',
            declineReason: 'Expired — no admin action within 7 days',
          },
        });

        await tx.userProfile.update({
          where: { id: req.userId },
          data: {
            pendingBalance: { decrement: req.amount },
            walletBalance: { increment: req.amount },
          },
        });

        await tx.transaction.create({
          data: {
            userId: req.userId,
            type: 'withdrawal_reversal',
            amount: req.amount,
            reference: req.id,
            metadata: { reason: 'auto_expired' },
          },
        });
      });

      EmailService.sendWithdrawalResult(
        req.user.email,
        'declined',
        req.amount.toString(),
        'Withdrawal request expired — no action was taken within 7 days'
      ).catch(() => {});

      logger.info(`Withdrawal ${req.id} auto-expired`);
    } catch (err) {
      logger.error(`Failed to expire withdrawal ${req.id}`, err);
    }
  }
}
