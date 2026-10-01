import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ProductService } from '../../services/product.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const result = await ProductService.listAdmin({
    search: q.search,
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductService.create(req.body);
  return ApiResponse.success(res, product, 'Product created', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductService.update(req.params.id, req.body);
  return ApiResponse.success(res, product, 'Product updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await ProductService.delete(req.params.id);
  return ApiResponse.success(res, result, 'Product deleted');
});

export const featureToggle = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  const isFeatured = req.body.isFeatured === true;
  const product = await ProductService.toggleFeatured(req.params.id, isFeatured);
  await AuditLogService.record({
    actorId: req.admin.sub,
    actorRole: 'admin',
    event: isFeatured ? 'product.featured' : 'product.unfeatured',
    entityType: 'product',
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, product, isFeatured ? 'Added to featured' : 'Removed from featured');
});
