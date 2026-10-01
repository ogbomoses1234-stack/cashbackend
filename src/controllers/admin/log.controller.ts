import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { prisma } from '../../config/database';
import { getPagination } from '../../utils/pagination';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.query;
  const { skip, take, page, perPage } = getPagination(q, { page: 1, perPage: 50 });

  const where: any = {};
  if (q.event) where.event = { contains: q.event, mode: 'insensitive' };
  if (q.actorId) where.actorId = q.actorId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = new Date(q.from);
    if (q.to) where.createdAt.lte = new Date(q.to);
  }

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.auditLog.count({ where }),
  ]);

  return ApiResponse.paginated(res, items, { page, perPage, total });
});
