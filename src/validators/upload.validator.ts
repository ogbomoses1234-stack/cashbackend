import { z } from 'zod';

export const presignSchema = z.object({
  body: z.object({
    purpose: z.enum(['receipt', 'dispute', 'chat', 'avatar', 'product']),
    mimeType: z.string().min(3).max(100),
    sizeBytes: z.number().int().positive().max(5 * 1024 * 1024),
    scope: z
      .object({
        orderId: z.string().uuid().optional(),
        disputeId: z.string().uuid().optional(),
        threadId: z.string().uuid().optional(),
        messageId: z.string().uuid().optional(),
        productId: z.string().uuid().optional(),
      })
      .optional(),
  }),
});

export const commitSchema = z.object({
  body: z.object({ objectKey: z.string().min(1).max(500) }),
});
