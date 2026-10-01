import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { OrderService } from '../../services/order.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await OrderService.listAdmin({
    status: q.status,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderService.getAdmin(req.params.id);
  return ApiResponse.success(res, order);
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const order = await OrderService.approve(req.params.id);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'order.approved',
    entityType: 'order',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, order, 'Order authorized for shipping');
});

export const flag = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const order = await OrderService.flag(req.params.id, req.body.reason);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'order.flagged',
    entityType: 'order',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { reason: req.body.reason },
  });
  return ApiResponse.success(res, order, 'Order flagged');
});

export const getReceiptUrl = asyncHandler(async (req: Request, res: Response) => {
  const result = await OrderService.getReceiptUrl(req.params.id);
  return ApiResponse.success(res, result);
});
