import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { CategoryService } from '../../services/category.service';

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await CategoryService.list();
  return ApiResponse.success(res, categories);
});
