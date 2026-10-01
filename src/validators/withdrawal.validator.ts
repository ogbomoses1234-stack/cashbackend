import { z } from 'zod';

export const createWithdrawalSchema = z.object({
  body: z.object({
    amount: z.number().int().min(100),
    bankCode: z.string().min(3).max(10),
    accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
    accountName: z.string().min(2).max(120),
  }),
});
