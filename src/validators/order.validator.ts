import { z } from 'zod';

export const createOrderSchema = z.object({
  body: z.object({
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().min(1).max(99),
        })
      )
      .min(1),
    paymentMethod: z.enum(['bank_transfer', 'pod']),
    deliveryAddress: z.string().min(10).max(500),
    receiptObjectKey: z.string().optional(),
  }),
});

export const orderIdParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});
