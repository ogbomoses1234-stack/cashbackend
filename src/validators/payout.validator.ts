import { z } from 'zod';

export const verifyAccountQuery = z.object({
  query: z.object({
    accountNumber: z.string().regex(/^\d{10}$/),
    bankCode: z.string().min(3).max(10),
  }),
});

export const savePayoutSchema = z.object({
  body: z.object({
    bankCode: z.string().min(3).max(10),
    accountNumber: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
    accountName: z.string().min(2).max(120),
  }),
});
