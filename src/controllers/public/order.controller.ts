import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { OrderService } from '../../services/order.service';
import { ApiError } from '../../utils/ApiError';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const order = await OrderService.create({ userId: req.user.sub, ...req.body });
  return ApiResponse.success(res, order, 'Order placed', 201);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const q: any = req.query;
  const result = await OrderService.listMine(req.user.sub, {
    page: q.page ? Number(q.page) : undefined,
    perPage: q.perPage ? Number(q.perPage) : undefined,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const order = await OrderService.getMine(req.user.sub, req.params.id);
  return ApiResponse.success(res, order);
});
