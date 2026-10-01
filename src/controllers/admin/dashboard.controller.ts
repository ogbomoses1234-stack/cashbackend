import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { logger } from '../../config/logger';

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/dashboard/metrics
   Returns all dashboard tiles + chart + recent activity.
   Uses enum values verified against prisma/schema.prisma.
═══════════════════════════════════════════════════════════ */
export const getMetrics = asyncHandler(async (_req: Request, res: Response) => {
  /* ─── 1. Total cashback redeemed ────────────────────── */
  let totalCashbackRedeemed = '0.00';
  try {
    const agg = await prisma.transaction.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { type: 'cashback_credit' },
    });
    totalCashbackRedeemed = (Number(agg._sum.amount ?? 0)).toFixed(2);
  } catch (err) {
    logger.warn('dashboard: transaction aggregate failed', { err });
  }

  /* ─── 2. Active sellers / staff ─────────────────────── */
  let activeSellers = 0;
  try {
    activeSellers = await prisma.userProfile.count({
      where: { role: 'staff', isActive: true },
    });
  } catch (err) {
    logger.warn('dashboard: staff count failed', { err });
  }

  /* ─── 3. Pending withdrawals ────────────────────────── */
  let pendingWithdrawals = 0;
  try {
    pendingWithdrawals = await prisma.withdrawalRequest.count({
      where: { status: 'pending' },
    });
  } catch (err) {
    logger.warn('dashboard: withdrawal count failed', { err });
  }

  /* ─── 4. Pending orders ─────────────────────────────── */
  let pendingOrders = 0;
  try {
    pendingOrders = await prisma.order.count({
      where: { status: 'Processing' },
    });
  } catch (err) {
    logger.warn('dashboard: order count failed', { err });
  }

  /* ─── 5. Serial lifecycle ───────────────────────────── */
  let serialLifecycle = { created: 0, dispatched: 0, redeemed: 0, disputed: 0 };
  try {
    const [created, dispatched, redeemed, disputed] = await Promise.all([
      prisma.productSerial.count({ where: { status: 'Created' } }),
      prisma.productSerial.count({ where: { status: 'Dispatched' } }),
      prisma.productSerial.count({ where: { status: 'Redeemed' } }),
      prisma.productSerial.count({ where: { status: 'Disputed' } }),
    ]);
    serialLifecycle = { created, dispatched, redeemed, disputed };
  } catch (err) {
    logger.warn('dashboard: serial counts failed', { err });
  }

  /* ─── 6. Redemption chart — last 7 days ─────────────── */
  const redemptionChart: Array<{ date: string; amount: string }> = [];
  try {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const txns = await prisma.transaction.findMany({
      where: {
        type: 'cashback_credit',
        createdAt: { gte: since },
      },
      select: { amount: true, createdAt: true },
    });

    /* Build a map of date→amount, initialized to 0 for all 7 days */
    const daily = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      daily.set(d.toISOString().slice(0, 10), 0);
    }

    for (const t of txns) {
      const key = t.createdAt.toISOString().slice(0, 10);
      if (daily.has(key)) {
        daily.set(key, (daily.get(key) ?? 0) + Number(t.amount));
      }
    }

    for (const [date, amount] of daily.entries()) {
      redemptionChart.push({ date, amount: amount.toFixed(2) });
    }
  } catch (err) {
    logger.warn('dashboard: chart failed', { err });
    /* Still return 7 empty days */
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      redemptionChart.push({ date: d.toISOString().slice(0, 10), amount: '0.00' });
    }
  }

  /* ─── 7. Recent activity from AuditLog ──────────────── */
  let recentActivity: Array<{
    id: string;
    event: string;
    actorId: string | null;
    actorRole: string | null;
    entityType: string | null;
    entityId: string | null;
    ipAddress: string | null;
    createdAt: string;
  }> = [];

  try {
    const logs = await prisma.auditLog.findMany({
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        event: true,
        actorId: true,
        actorRole: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        createdAt: true,
      },
    });

    recentActivity = logs.map((l) => ({
      id: l.id,
      event: l.event,
      actorId: l.actorId,
      actorRole: l.actorRole,
      entityType: l.entityType,
      entityId: l.entityId,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
    }));
  } catch (err) {
    logger.warn('dashboard: audit log fetch failed', { err });
  }

  /* ─── 8. Return the payload ─────────────────────────── */
  return ApiResponse.success(res, {
    totalCashbackRedeemed,
    activeSellers,
    pendingWithdrawals,
    pendingOrders,
    redemptionChart,
    serialLifecycle,
    recentActivity,
  });
});

/* ═══════════════════════════════════════════════════════════
   GET /api/admin/dashboard/debug — raw DB inspection
═══════════════════════════════════════════════════════════ */
export const debugMetrics = asyncHandler(async (_req: Request, res: Response) => {
  const out: Record<string, unknown> = {};

  try {
    const [
      txCount,
      txByType,
      withdrawalCount,
      withdrawalByStatus,
      orderCount,
      orderByStatus,
      serialCount,
      serialByStatus,
      userCount,
      userByRole,
      auditLogCount,
      sampleCredit,
      sampleWithdrawal,
      sampleOrder,
      sampleSerial,
    ] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.groupBy({ by: ['type'], _count: true }),
      prisma.withdrawalRequest.count(),
      prisma.withdrawalRequest.groupBy({ by: ['status'], _count: true }),
      prisma.order.count(),
      prisma.order.groupBy({ by: ['status'], _count: true }),
      prisma.productSerial.count(),
      prisma.productSerial.groupBy({ by: ['status'], _count: true }),
      prisma.userProfile.count(),
      prisma.userProfile.groupBy({ by: ['role'], _count: true }),
      prisma.auditLog.count(),
      prisma.transaction.findFirst({
        where: { type: 'cashback_credit' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.withdrawalRequest.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.order.findFirst({ orderBy: { createdAt: 'desc' } }),
      prisma.productSerial.findFirst({ orderBy: { createdAt: 'desc' } }),
    ]);

    out.counts = {
      transactions: txCount,
      withdrawals: withdrawalCount,
      orders: orderCount,
      serials: serialCount,
      users: userCount,
      auditLogs: auditLogCount,
    };

    out.breakdown = {
      transactionsByType: txByType,
      withdrawalsByStatus: withdrawalByStatus,
      ordersByStatus: orderByStatus,
      serialsByStatus: serialByStatus,
      usersByRole: userByRole,
    };

    out.samples = {
      latestCredit: sampleCredit,
      latestWithdrawal: sampleWithdrawal,
      latestOrder: sampleOrder,
      latestSerial: sampleSerial,
    };
  } catch (e) {
    out.error = (e as Error).message;
  }

  return ApiResponse.success(res, out);
});
