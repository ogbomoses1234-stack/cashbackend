import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { StaffService } from '../../services/staff.service';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../config/database';

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await StaffService.changePassword({
    userId: req.user.sub,
    oldPassword: req.body.oldPassword,
    newPassword: req.body.newPassword,
  });
  return ApiResponse.success(res, result, 'Password changed');
});

export const myStock = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const serials = await prisma.productSerial.findMany({
    where: { dispatchedBy: req.user.sub },
    orderBy: { dispatchedAt: 'desc' },
    include: { product: { select: { id: true, title: true } } },
    take: 200,
  });

  const stats = {
    takenOut: serials.length,
    sold: serials.filter((s) => s.status === 'Redeemed').length,
    awaitingSale: serials.filter((s) => s.status === 'Dispatched').length,
  };

  return ApiResponse.success(res, { stats, serials });
});
