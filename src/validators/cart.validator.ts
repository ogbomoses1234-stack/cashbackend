import { z } from 'zod';

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  }),
});

export const updateCartSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ quantity: z.number().int().min(1).max(99) }),
});

export const cartItemParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});
