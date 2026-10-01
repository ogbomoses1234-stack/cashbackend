import { prisma } from '../../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { WithdrawalService, enrichWithdrawalForAdmin } from '../../services/withdrawal.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;

  const where: any = {};
  if (q.status && q.status !== 'all') where.status = q.status;

  const page = Math.max(1, parseInt(q.page ?? '1', 10));
  const perPage = Math.min(200, parseInt(q.perPage ?? '30', 10));
  const skip = (page - 1) * perPage;

  const [items, total] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phoneNumber: true },
        },
      },
    }),
    prisma.withdrawalRequest.count({ where }),
  ]);

  return ApiResponse.paginated(
    res,
    items.map(enrichWithdrawalForAdmin),
    { page, perPage, total }
  );
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await WithdrawalService.approve(req.params.id, req.admin.sub);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'withdrawal.approved',
    entityType: 'withdrawal',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'Withdrawal approved');
});

export const decline = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await WithdrawalService.decline(req.params.id, req.admin.sub, req.body.reason);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'withdrawal.declined',
    entityType: 'withdrawal',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { reason: req.body.reason },
  });
  return ApiResponse.success(res, result, 'Withdrawal declined');
});

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/withdrawals/:id
   Returns the withdrawal + every serial that funded it.

   For each cashback_credit transaction tied to this user
   BEFORE the withdrawal was created, we look up the serial
   via `reference` (which stores the serial number) and
   include its dispatcher + redeemer details.
═══════════════════════════════════════════════════════════ */
export const getWithdrawalDetail = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  /* ─── 1. Load withdrawal + customer ─────────────────── */
  const withdrawal = await prisma.withdrawalRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, fullName: true, email: true, phoneNumber: true },
      },
    },
  });

  if (!withdrawal) {
    return res.status(404).json({
      success: false,
      error: { code: 'WITHDRAWAL_NOT_FOUND', message: 'Withdrawal not found' },
    });
  }

  /* ─── 2. Find cashback credits BEFORE this withdrawal ─── */
  const credits = await prisma.transaction.findMany({
    where: {
      userId: withdrawal.userId,
      type: 'cashback_credit',
      createdAt: { lte: withdrawal.createdAt },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  /* ─── 3. Collect serial numbers from references ──────── */
  const serialNumbers = credits
    .map((c) => c.reference)
    .filter((s): s is string => !!s);

  /* ─── 4. Load those serials with dispatch + redeem ───── */
  const serials = serialNumbers.length
    ? await prisma.productSerial.findMany({
        where: { serialNumber: { in: serialNumbers } },
        include: {
          product: { select: { id: true, title: true } },
          dispatcher: {
            select: {
              id: true, fullName: true, email: true,
              phoneNumber: true, role: true, staffCode: true,
            },
          },
          redeemer: {
            select: {
              id: true, fullName: true, email: true,
              phoneNumber: true, role: true,
            },
          },
        },
      })
    : [];

  const serialMap = new Map(serials.map((s) => [s.serialNumber, s]));

  /* ─── 5. Build the linkedSerials array ───────────────── */
  const linkedSerials = credits.map((c) => {
    const serial = c.reference ? serialMap.get(c.reference) : undefined;

    if (!serial) {
      return {
        serialNumber: c.reference ?? '—',
        creditedAt: c.createdAt.toISOString(),
        creditedAmount: c.amount.toString(),
        serialFound: false,
      };
    }

    let timeToRedeemSeconds: number | null = null;
    if (serial.dispatchedAt && serial.redeemedAt) {
      const diff =
        new Date(serial.redeemedAt).getTime() -
        new Date(serial.dispatchedAt).getTime();
      if (isFinite(diff) && diff >= 0) {
        timeToRedeemSeconds = Math.round(diff / 1000);
      }
    }

    return {
      serialNumber: serial.serialNumber,
      productTitle: serial.product?.title ?? '—',
      serialStatus: serial.status,
      creditedAt: c.createdAt.toISOString(),
      creditedAmount: c.amount.toString(),
      serialFound: true,
      dispatchedBy: serial.dispatcher ?? null,
      dispatchedAt: serial.dispatchedAt?.toISOString() ?? null,
      redeemedBy: serial.redeemer ?? null,
      redeemedAt: serial.redeemedAt?.toISOString() ?? null,
      timeToRedeemSeconds,
    };
  });

  /* ─── 6. Summary ─────────────────────────────────────── */
  const withStaff = linkedSerials.filter(
    (s) => s.serialFound && (s as { dispatchedBy?: unknown }).dispatchedBy
  ).length;
  const withoutStaff = linkedSerials.filter(
    (s) => s.serialFound && !(s as { dispatchedBy?: unknown }).dispatchedBy
  ).length;
  const totalCredited = linkedSerials.reduce(
    (sum, s) => sum + parseFloat(s.creditedAmount || '0'),
    0
  );

  /* ─── 7. Resolve bankName from the code ──────────────── */
  const { resolveBankName } = await import('../../services/withdrawal.service');
  const bankName = resolveBankName(
    withdrawal.bankCode,
    (withdrawal as unknown as { bankName?: string | null }).bankName ?? null
  );

  /* ─── 8. Response ────────────────────────────────────── */
  return ApiResponse.success(res, {
    id: withdrawal.id,
    amount: withdrawal.amount.toString(),
    status: withdrawal.status,
    bankCode: withdrawal.bankCode,
    bankName,
    accountNumber: withdrawal.accountNumber,
    accountName: withdrawal.accountName,
    declineReason: withdrawal.declineReason ?? null,
    processedBy: withdrawal.processedBy ?? null,
    processedAt: (withdrawal as unknown as { updatedAt?: Date }).updatedAt?.toISOString?.() ?? null,
    createdAt: withdrawal.createdAt.toISOString(),
    customer: {
      id: withdrawal.user.id,
      fullName: withdrawal.user.fullName ?? '—',
      email: withdrawal.user.email,
      phoneNumber: withdrawal.user.phoneNumber ?? null,
    },
    linkedSerials,
    summary: {
      totalSerials: linkedSerials.length,
      withStaffDispatch: withStaff,
      withoutStaffDispatch: withoutStaff,
      totalCredited: totalCredited.toFixed(2),
    },
  });
});
