import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { prisma } from '../../config/database';
import { config } from '../../config';

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
