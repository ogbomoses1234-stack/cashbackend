import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { StaffService } from '../../services/staff.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await StaffService.list({
    search: q.search,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await StaffService.create(req.body);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'staff.created',
    entityType: 'staff',
    entityId: result.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'Staff created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await StaffService.update(req.params.id, req.body);
  return ApiResponse.success(res, result, 'Staff updated');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await StaffService.resetPassword(req.params.id);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'staff.password_reset',
    entityType: 'staff',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'Password reset. New credentials emailed.');
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await StaffService.deactivate(req.params.id);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'staff.deactivated',
    entityType: 'staff',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'Staff deactivated');
});
