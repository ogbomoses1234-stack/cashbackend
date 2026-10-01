import { z } from 'zod';

export const createBannerSchema = z.object({
  body: z.object({
    imageUrl: z.string().min(1).max(500),
    headline: z.string().min(2).max(160),
    subtext: z.string().max(280).optional().nullable(),
    ctaText: z.string().max(60).optional().nullable(),
    ctaUrl: z.string().max(300).optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const updateBannerSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    imageUrl: z.string().min(1).max(500).optional(),
    headline: z.string().min(2).max(160).optional(),
    subtext: z.string().max(280).optional().nullable(),
    ctaText: z.string().max(60).optional().nullable(),
    ctaUrl: z.string().max(300).optional().nullable(),
    sortOrder: z.number().int().optional(),
    isActive: z.boolean().optional(),
  }),
});

export const bannerIdParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});
