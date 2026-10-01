import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ScanService } from '../../services/scan.service';
import { checkScanRate } from '../../middleware/rateLimit.middleware';
import { config } from '../../config';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const redeem = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  await checkScanRate(
    req.user.sub,
    config.business.scanRateLimit,
    config.business.scanLockoutMinutes * 60
  );

  const result = await ScanService.redeemSerial({
    serialNumber: req.body.serialNumber,
    sig: req.body.sig,
    customerId: req.user.sub,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  await AuditLogService.record({
    actorId: req.user.sub,
    actorRole: 'customer',
    event: 'scan.redeem',
    entityType: 'serial',
    entityId: req.body.serialNumber,
    ipAddress: req.ip,
  });

  return ApiResponse.success(res, result, 'Cashback credited!');
});

export const staffDispatch = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const result = await ScanService.dispatchSerial({
    serialNumber: req.body.serialNumber,
    sig: req.body.sig,
    staffId: req.user.sub,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  await AuditLogService.record({
    actorId: req.user.sub,
    actorRole: 'staff',
    event: 'scan.dispatch',
    entityType: 'serial',
    entityId: req.body.serialNumber,
    ipAddress: req.ip,
  });

  return ApiResponse.success(res, result, 'Unit recorded as taken out');
});
