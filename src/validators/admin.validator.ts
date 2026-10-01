import { z } from 'zod';

export const createStaffSchema = z.object({
  body: z.object({
    fullName: z.string().min(3).max(120),
    email: z.string().email(),
    phoneNumber: z.string().min(10).max(15),
    salesPoint: z.string().min(2).max(120),
    tempPassword: z.string().min(8).optional(),
  }),
});

export const updateStaffSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    fullName: z.string().min(3).max(120).optional(),
    phoneNumber: z.string().min(10).max(15).optional(),
    salesPoint: z.string().min(2).max(120).optional(),
  }),
});

export const createProductSchema = z.object({
  body: z.object({
    title: z.string().min(2).max(160),
    description: z.string().max(4000).optional(),
    price: z.number().positive(),
    thumbnailUrl: z.string().url().optional(),
    category: z.string().max(60).optional(),
    stockCount: z.number().int().min(0).optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(2).max(160).optional(),
    description: z.string().max(4000).optional(),
    price: z.number().positive().optional(),
    thumbnailUrl: z.string().url().optional(),
    category: z.string().max(60).optional(),
    stockCount: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const generateSerialsSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    volume: z.number().int().min(1).max(10000),
  }),
});

export const declineWithdrawalSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().min(3).max(500) }),
});

export const flagOrderSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().min(3).max(500) }),
});

export const idParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const deactivateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().min(3).max(500).default('Deactivated by admin') }),
});

export const disputeUpdateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['open', 'investigating', 'resolved', 'rejected']),
    adminNote: z.string().max(2000).optional(),
  }),
});

export const featureToggleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ isFeatured: z.boolean() }),
});
