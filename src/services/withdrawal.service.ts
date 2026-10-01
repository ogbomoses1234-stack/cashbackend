import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { toMoney } from '../utils/money';
import { EmailService } from './email.service';
import { PayoutService } from './payout.service';
import { getPagination } from '../utils/pagination';

/* ═══════════════════════════════════════════
   Nigerian bank code → name (fallback map)
═══════════════════════════════════════════ */
const BANK_NAMES: Record<string, string> = {
  '033': 'UBA',
  '044': 'Access Bank',
  '058': 'GTBank',
  '057': 'Zenith Bank',
  '011': 'First Bank',
  '214': 'First City Monument Bank',
  '070': 'Fidelity Bank',
  '076': 'Polaris Bank',
  '082': 'Keystone Bank',
  '101': 'Providus Bank',
  '221': 'Stanbic IBTC',
  '232': 'Sterling Bank',
  '301': 'Jaiz Bank',
  '302': 'Wema Bank',
  '303': 'Union Bank',
  '307': 'Ecobank',
  '100033': 'PalmPay',
  '999991': 'Moniepoint',
  '999992': 'OPay',
};

export function resolveBankName(bankCode: string, fallbackName?: string | null): string {
  if (fallbackName && fallbackName.trim()) return fallbackName;
  return BANK_NAMES[bankCode] ?? `Bank (${bankCode})`;
}

/**
 * Enrich a withdrawal row for the admin frontend:
 * adds bankName + customer + processedAt + processedBy
 */
export function enrichWithdrawalForAdmin(w: any): Record<string, unknown> {
  return {
    id: w.id,
    amount: w.amount?.toString() ?? '0',
    bankCode: w.bankCode,
    bankName: resolveBankName(w.bankCode, w.bankName),
    accountNumber: w.accountNumber,
    accountName: w.accountName,
    status: w.status,
    declineReason: w.declineReason ?? null,
    processedBy: w.processedBy ?? null,
    processedAt: w.updatedAt?.toISOString?.() ?? w.updatedAt ?? null,
    createdAt: w.createdAt?.toISOString?.() ?? w.createdAt,
    customer: w.user
      ? {
          id: w.user.id,
          fullName: w.user.fullName ?? '—',
          email: w.user.email ?? '—',
          phoneNumber: w.user.phoneNumber ?? null,
        }
      : null,
  };
}


export class WithdrawalService {
  static async request(opts: {
    userId: string;
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName: string;
  }) {
    logger.info('withdrawal.request received', { userId: opts.userId, amount: opts.amount, bankCode: opts.bankCode, accountNumber: opts.accountNumber ? opts.accountNumber.slice(-4) : null });
    const { userId, amount, bankCode, accountNumber, accountName } = opts;
    const naira = toMoney(amount);

    if (amount < config.business.minWithdrawal) {
      throw ApiError.badRequest(
        'WITHDRAWAL_MIN',
        `Minimum withdrawal is ₦${config.business.minWithdrawal}`
      );
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.userProfile.findUnique({ where: { id: userId } });
      if (!user) throw ApiError.notFound();
      if (user.walletBalance.lessThan(naira)) {
        throw ApiError.badRequest('WITHDRAWAL_INSUFFICIENT', 'Insufficient balance');
      }

      const request = await tx.withdrawalRequest.create({
        data: { userId, amount: naira, bankCode, accountNumber, accountName },
      });

      await tx.userProfile.update({
        where: { id: userId },
        data: {
          walletBalance: { decrement: naira },
          pendingBalance: { increment: naira },
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'withdrawal_debit',
          amount: naira,
          reference: request.id,
        },
      });

      return request;
    });
  }

  static async listMine(userId: string) {
    return prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async listAdmin(opts: { status?: string; page?: number; perPage?: number } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });
    const where: any = {};
    if (opts.status) where.status = opts.status;

    const [items, total] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
        skip,
        take,
      }),
      prisma.withdrawalRequest.count({ where }),
    ]);

    return { items, meta: { page, perPage, total } };
  }

  static async approve(requestId: string, adminId: string) {
    const req = await prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!req) throw ApiError.notFound();
    if (req.status !== 'pending') throw ApiError.conflict('WITHDRAWAL_NOT_PENDING', 'Already processed');

    // Attempt payout before committing DB changes
    const payout = await PayoutService.sendPayout({
      amountNaira: Number(req.amount),
      bankCode: req.bankCode,
      accountNumber: req.accountNumber,
      accountName: req.accountName,
      reason: `QR CashBack payout ${req.id}`,
    });

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReq = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: { status: 'approved', processedBy: adminId, payoutRef: payout.reference },
      });

      await tx.userProfile.update({
        where: { id: req.userId },
        data: { pendingBalance: { decrement: req.amount } },
      });

      return updatedReq;
    });

    EmailService.sendWithdrawalResult(
      req.user.email,
      'approved',
      req.amount.toString()
    ).catch(() => {});

    return updated;
  }

  static async decline(requestId: string, adminId: string, reason: string) {
    const req = await prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!req) throw ApiError.notFound();
    if (req.status !== 'pending') throw ApiError.conflict('WITHDRAWAL_NOT_PENDING', 'Already processed');

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.withdrawalRequest.update({
        where: { id: requestId },
        data: { status: 'declined', declineReason: reason, processedBy: adminId },
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
          reference: requestId,
          metadata: { reason },
        },
      });

      return u;
    });

    EmailService.sendWithdrawalResult(
      req.user.email,
      'declined',
      req.amount.toString(),
      reason
    ).catch(() => {});

    return updated;
  }
}
