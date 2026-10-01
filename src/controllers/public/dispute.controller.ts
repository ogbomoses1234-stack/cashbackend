import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { DisputeService } from '../../services/dispute.service';
import { ApiError } from '../../utils/ApiError';

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const dispute = await DisputeService.create({ userId: req.user.sub, ...req.body });
  return ApiResponse.success(res, dispute, 'Dispute submitted', 201);
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const items = await DisputeService.listMine(req.user.sub);
  return ApiResponse.success(res, items);
});
