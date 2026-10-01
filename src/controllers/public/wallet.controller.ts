import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { WalletService } from '../../services/wallet.service';
import { ApiError } from '../../utils/ApiError';

export const getWallet = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const summary = await WalletService.getSummary(req.user.sub);
  return ApiResponse.success(res, summary);
});

export const listTransactions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const items = await WalletService.listTransactions(req.user.sub);
  return ApiResponse.success(res, items);
});
