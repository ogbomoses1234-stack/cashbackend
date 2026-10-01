import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { ProductService } from '../../services/product.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.validatedQuery ?? req.query;
  const result = await ProductService.listPublic({
    search: q.search,
    category: q.category,
    featured: q.featured === true || q.featured === 'true',
    sort: q.sort,
    page: q.page,
    perPage: q.perPage,
  });
  return ApiResponse.paginated(res, result.items, result.meta);
});

export const getBySlug = asyncHandler(async (req: Request, res: Response) => {
  const product = await ProductService.getBySlug(req.params.slug);
  return ApiResponse.success(res, product);
});
