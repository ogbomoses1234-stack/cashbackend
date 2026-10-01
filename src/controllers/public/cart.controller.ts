import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { CartService } from '../../services/cart.service';
import { ApiError } from '../../utils/ApiError';

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const items = await CartService.list(req.user.sub);
  return ApiResponse.success(res, items);
});

export const add = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await CartService.add(req.user.sub, req.body.productId, req.body.quantity);
  return ApiResponse.success(res, item, 'Added to cart', 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const item = await CartService.updateQuantity(req.user.sub, req.params.id, req.body.quantity);
  return ApiResponse.success(res, item, 'Cart updated');
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await CartService.remove(req.user.sub, req.params.id);
  return ApiResponse.success(res, result, 'Item removed');
});

export const clear = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await CartService.clear(req.user.sub);
  return ApiResponse.success(res, result);
});
