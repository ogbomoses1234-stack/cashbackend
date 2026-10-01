import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { SerialService } from '../../services/serial.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const generate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await SerialService.generateBatch(req.body);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'serial.batch.generated',
    entityType: 'batch',
    entityId: result.batchId,
    ipAddress: req.ip,
    details: { count: result.count, productId: req.body.productId },
  });
  return ApiResponse.success(res, result, 'Batch generated', 201);
});

export const listByBatch = asyncHandler(async (req: Request, res: Response) => {
  const serials = await SerialService.listByBatch(req.params.batchId);
  return ApiResponse.success(res, serials);
});

export const downloadArchive = asyncHandler(async (req: Request, res: Response) => {
  const url = await SerialService.getBatchArchiveUrl(req.params.batchId);
  return ApiResponse.success(res, { url });
});

export const listTracker = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await SerialService.listTracker({
    status: q.status,
    search: q.search,
    dispatchedBy: q.dispatchedBy,
    redeemedBy: q.redeemedBy,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const getTrackerDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await SerialService.getTrackerDetail(req.params.serialNumber);
  return ApiResponse.success(res, result);
});
