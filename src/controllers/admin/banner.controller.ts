import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { BannerService } from '../../services/banner.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await BannerService.listAll();
  return ApiResponse.success(res, banners);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const banner = await BannerService.create(req.body);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'banner.created',
    entityType: 'banner',
    entityId: banner.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, banner, 'Banner created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const banner = await BannerService.update(req.params.id, req.body);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'banner.updated',
    entityType: 'banner',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, banner, 'Banner updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const result = await BannerService.delete(req.params.id);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: 'banner.deleted',
    entityType: 'banner',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'Banner deleted');
});
