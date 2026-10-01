import { prisma } from '../config/database';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';
import { QrService } from './qr.service';
import { EmailService } from './email.service';
import { toMoney } from '../utils/money';
import { logger } from '../config/logger';

/* ═══════════════════════════════════════════
   Scan audit helper — writes to scan_events table
═══════════════════════════════════════════ */
async function logScan(opts: {
  serialNumber: string;
  userId?: string | null;
  userRole?: string | null;
  scanType: string;
  success: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.scanEvent.create({
      data: {
        serialNumber: opts.serialNumber,
        userId: opts.userId ?? null,
        userRole: opts.userRole ?? null,
        scanType: opts.scanType,
        success: opts.success,
        errorCode: opts.errorCode ?? null,
        errorMessage: opts.errorMessage ?? null,
        ipAddress: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
  } catch (err) {
    // Never fail the request because of audit logging
    logger.warn('scan audit write failed', { err, serialNumber: opts.serialNumber });
  }
}

export class ScanService {
  /**
   * STAFF — mark a serial as taken out for sale.
   * Stock tracking only; never touches wallets.
   */
  static async dispatchSerial(opts: {
    serialNumber: string;
    sig: string;
    staffId: string;
    ip: string;
    userAgent?: string;
  }) {
    const { serialNumber, sig, staffId, ip, userAgent } = opts;

    const serial = await prisma.productSerial.findUnique({
      where: { serialNumber },
      include: { product: true },
    });

    if (!serial) throw ApiError.badRequest('QR_UNKNOWN_SERIAL', 'Unrecognized code');
    // Verify signature only when provided. Legacy QRs don't include it.
    if (sig && sig.length > 0) {
      QrService.assertValidSignature(serialNumber, sig, serial.qrSignature);
    } else {
      logger.warn('Staff dispatch without signature — legacy/dev mode', {
        serialNumber,
        staffId,
      });
    }

    if (serial.status === 'Dispatched') {
      throw ApiError.conflict('QR_ALREADY_DISPATCHED', 'This unit is already recorded as taken out');
    }
    if (serial.status === 'Redeemed') {
      throw ApiError.conflict('QR_ALREADY_REDEEMED', 'This unit has been sold and claimed');
    }
    if (serial.status !== 'Created') {
      throw ApiError.badRequest('QR_NOT_AVAILABLE', 'This unit cannot be dispatched');
    }

    const [updated] = await prisma.$transaction([
      prisma.productSerial.update({
        where: { serialNumber },
        data: { status: 'Dispatched', dispatchedBy: staffId, dispatchedAt: new Date() },
      }),
      prisma.serialScanLog.create({
        data: {
          serialNumber,
          scannedBy: staffId,
          scanType: 'staff_dispatch',
          ipAddress: ip,
          userAgent,
        },
      }),
    ]);

    await logScan({
      serialNumber,
      userId: staffId,
      userRole: 'staff',
      scanType: 'staff_dispatch',
      success: true,
      ip,
      userAgent,
    });

    return { serial: updated, product: serial.product };
  }

  /**
   * CUSTOMER — redeem a serial and credit cashback.
   */
  static async redeemSerial(opts: {
    serialNumber: string;
    sig: string;
    customerId: string;
    ip: string;
    userAgent?: string;
  }) {
    const { serialNumber, sig, customerId, ip, userAgent } = opts;

    const serial = await prisma.productSerial.findUnique({
      where: { serialNumber },
      include: { product: true },
    });

    if (!serial) throw ApiError.badRequest('QR_UNKNOWN_SERIAL', 'Unrecognized code');
    // Verify signature only when provided. Legacy QRs don't include it.
    if (sig && sig.length > 0) {
      QrService.assertValidSignature(serialNumber, sig, serial.qrSignature);
    } else {
      logger.warn('QR redeemed without signature — legacy/dev mode', {
        serialNumber,
        customerId,
      });
    }

    if (serial.status === 'Redeemed') {
      throw ApiError.conflict('QR_ALREADY_REDEEMED', 'This voucher has already been claimed');
    }

    // ─── DEV MODE: auto-dispatch a 'Created' serial ───
    // In production this is disabled so staff MUST scan first.
    // In dev, this lets you test the full cashback flow without
    // manually running the staff scan step.
    if (serial.status === 'Created' && config.business.devAutoDispatch) {
      logger.warn('DEV: auto-dispatching Created serial on customer scan', {
        serialNumber,
        customerId,
      });

      await prisma.productSerial.update({
        where: { serialNumber },
        data: {
          status: 'Dispatched',
          dispatchedAt: new Date(),
        },
      });

      await prisma.serialScanLog.create({
        data: {
          serialNumber,
          scannedBy: customerId,
          scanType: 'staff_dispatch',
          ipAddress: ip,
          userAgent,
          geoLat: null,
          geoLng: null,
        } as any,
      });

      // Refresh in-memory serial
      serial.status = 'Dispatched';
    } else if (serial.status !== 'Dispatched') {
      throw ApiError.badRequest('QR_NOT_DISPATCHED', 'Product not yet released for sale');
    }

    const amount = toMoney(config.business.cashbackAmount);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.userProfile.findUnique({ where: { id: customerId } });
      if (!user) throw ApiError.notFound('USER_NOT_FOUND', 'User profile not found');

      const newBalance = user.walletBalance.add(amount);
      const newTotal = user.totalEarned.add(amount);

      await tx.productSerial.update({
        where: { serialNumber },
        data: { status: 'Redeemed', redeemedBy: customerId, redeemedAt: new Date() },
      });

      await tx.userProfile.update({
        where: { id: customerId },
        data: { walletBalance: newBalance, totalEarned: newTotal },
      });

      await tx.transaction.create({
        data: {
          userId: customerId,
          type: 'cashback_credit',
          amount,
          reference: serialNumber,
        },
      });

      await tx.serialScanLog.create({
        data: {
          serialNumber,
          scannedBy: customerId,
          scanType: 'customer_redeem',
          ipAddress: ip,
          userAgent,
        },
      });

      return {
        newBalance: newBalance.toString(),
        amount: amount.toString(),
      };
    });

    // Fire-and-forget email
    prisma.userProfile
      .findUnique({ where: { id: customerId }, select: { email: true } })
      .then((u) => {
        if (u?.email) {
          EmailService.sendCashbackCredited(u.email, result.amount, result.newBalance).catch(
            () => {}
          );
        }
      })
      .catch(() => {});

    await logScan({
      serialNumber,
      userId: customerId,
      userRole: 'customer',
      scanType: 'customer_redeem',
      success: true,
      ip,
      userAgent,
    });

    return { ...result, product: serial.product };
  }
}
