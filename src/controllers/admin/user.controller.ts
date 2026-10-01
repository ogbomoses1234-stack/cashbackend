import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { UserService } from '../../services/user.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await UserService.list({
    role: q.role,
    status: q.status,
    search: q.search,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserService.get(req.params.id);
  return ApiResponse.success(res, user);
});

export const deactivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await UserService.deactivate(req.params.id, req.body.reason);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'user.deactivated',
    entityType: 'user',
    entityId: req.params.id,
    ipAddress: req.ip,
    details: { reason: req.body.reason },
  });
  return ApiResponse.success(res, result, 'User deactivated');
});

export const reactivate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await UserService.reactivate(req.params.id);
  return ApiResponse.success(res, result, 'User reactivated');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await UserService.resetPassword(req.params.id);
  return ApiResponse.success(res, result, 'Password reset');
});

export const purge = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await UserService.purge(req.params.id);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'user.purged',
    entityType: 'user',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'User purged (NDPR erasure)');
});
