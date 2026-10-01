import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { BannerService } from '../../services/banner.service';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const banners = await BannerService.listActive();
  return ApiResponse.success(res, banners);
});
