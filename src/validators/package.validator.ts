import { z } from 'zod';

export const createPackageSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200),
    notes: z.string().max(2000).optional(),
    country: z.string().min(2).max(100),
    city: z.string().min(1).max(100),
    deliveryAddress: z.string().min(10).max(500),
    contactPhone: z.string().min(7).max(20),
  }),
});

export const updatePackageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    title: z.string().min(3).max(200).optional(),
    notes: z.string().max(2000).optional().nullable(),
    country: z.string().min(2).max(100).optional(),
    city: z.string().min(1).max(100).optional(),
    deliveryAddress: z.string().min(10).max(500).optional(),
    contactPhone: z.string().min(7).max(20).optional(),
  }),
});

export const packageIdParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const packageItemParams = z.object({
  params: z.object({
    id: z.string().uuid(),
    itemId: z.string().uuid(),
  }),
});

export const addPackageItemSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(200),
    details: z.string().max(1000).optional(),
    quantity: z.number().int().min(1).max(99),
    estimatedPrice: z.string().max(20).optional(),
    imageObjectKey: z.string().max(500).optional(),
  }),
});

export const updatePackageItemSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    itemId: z.string().uuid(),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    details: z.string().max(1000).optional().nullable(),
    quantity: z.number().int().min(1).max(99).optional(),
    estimatedPrice: z.string().max(20).optional().nullable(),
    imageObjectKey: z.string().max(500).optional().nullable(),
  }),
});

export const requestEditSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().min(10).max(1000) }),
});

export const sendPackageMessageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    body: z.string().min(1).max(5000),
    attachmentKey: z.string().max(500).optional(),
  }),
});
