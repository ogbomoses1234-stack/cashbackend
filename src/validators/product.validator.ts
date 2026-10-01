import { z } from 'zod';

export const listProductsQuery = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.string().optional(),
    featured: z.union([z.literal('true'), z.literal('false'), z.boolean()]).optional(),
    sort: z.enum(['newest', 'price_asc', 'price_desc']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const productSlugParams = z.object({
  params: z.object({ slug: z.string().min(1) }),
});
