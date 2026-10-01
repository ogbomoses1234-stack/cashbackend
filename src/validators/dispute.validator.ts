import { z } from 'zod';

export const createDisputeSchema = z.object({
  body: z.object({
    serialNumber: z.string().min(6).max(24),
    description: z.string().min(10).max(2000),
    photoObjectKey: z.string().max(500).optional(),
  }),
});
