import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../config/database';
import { config } from '../../config';
import { NotificationPreferencesService } from '../../services/notificationPreferences.service';
import { AuditLogService } from '../../services/auditLog.service';

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.systemSetting.findMany();
  const stored: Record<string, string> = {};
  for (const r of rows) stored[r.key] = r.value;

  return ApiResponse.success(res, {
    effective: {
      cashbackAmount: config.business.cashbackAmount,
      minWithdrawal: config.business.minWithdrawal,
      scanRateLimit: config.business.scanRateLimit,
      scanLockoutMinutes: config.business.scanLockoutMinutes,
      otpTtlMinutes: config.business.otpTtlMinutes,
      otpMaxAttempts: config.business.otpMaxAttempts,
    },
    stored,
  });
});

export const updateSetting = asyncHandler(async (req: Request, res: Response) => {
  const { key, value } = req.body;
  const row = await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: String(value) },
    update: { value: String(value) },
  });
  return ApiResponse.success(res, row, 'Setting updated');
});

/* ─── Admin notification preferences ─────────────────── */

export const getNotificationPrefs = asyncHandler(async (_req: Request, res: Response) => {
  const prefs = await NotificationPreferencesService.get();
  return ApiResponse.success(res, prefs);
});

export const updateNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');

  const prefs = await NotificationPreferencesService.update({
    order: req.body.order,
    package: req.body.package,
    withdrawal: req.body.withdrawal,
    email: req.body.email,
  });

  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'settings.notifications_updated',
    entityType: 'settings',
    entityId: 'notifications',
    ipAddress: req.ip,
    details: {
      order: prefs.order,
      package: prefs.package,
      withdrawal: prefs.withdrawal,
      email: prefs.email,
    },
  });

  return ApiResponse.success(res, prefs, 'Notification preferences saved');
});