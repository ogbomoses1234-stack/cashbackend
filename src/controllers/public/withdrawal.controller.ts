import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { WithdrawalService } from '../../services/withdrawal.service';
import { ApiError } from '../../utils/ApiError';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await WithdrawalService.request({ userId: req.user.sub, ...req.body });
  return ApiResponse.success(res, result, 'Withdrawal requested', 201);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const items = await WithdrawalService.listMine(req.user.sub);
  return ApiResponse.success(res, items);
});
