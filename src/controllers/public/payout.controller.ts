import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../config/database';
import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { BankService } from '../../services/bank.service';

export const listBanks = asyncHandler(async (_req: Request, res: Response) => {
  const banks = await BankService.listBanks();
  return ApiResponse.success(res, banks);
});

export const verifyAccount = asyncHandler(async (req: Request, res: Response) => {
  const q: any = req.validatedQuery ?? req.query;
  const result = await BankService.resolveAccount(q.accountNumber, q.bankCode);
  return ApiResponse.success(res, result);
});

export const savePayout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { bankCode, accountNumber, accountName } = req.body;

  const updated = await prisma.userProfile.update({
    where: { id: req.user.sub },
    data: {
      payoutBankCode: bankCode,
      payoutAccountNumber: accountNumber,
      payoutAccountName: accountName,
    },
    select: {
      payoutBankCode: true,
      payoutAccountNumber: true,
      payoutAccountName: true,
    },
  });

  return ApiResponse.success(res, updated, 'Payout account saved');
});

export const getPayout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();

  const profile = await prisma.userProfile.findUnique({
    where: { id: req.user.sub },
    select: {
      payoutBankCode: true,
      payoutAccountNumber: true,
      payoutAccountName: true,
    },
  });

  return ApiResponse.success(res, profile ?? {});
});
