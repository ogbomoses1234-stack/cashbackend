import { z } from 'zod';

export const adminPackageListQuery = z.object({
  query: z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    perPage: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const adminPackageIdParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const adminSetStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum([
      'submitted',
      'quoted',
      'approved',
      'in_progress',
      'shipped',
      'delivered',
      'cancelled',
    ]),
    reason: z.string().max(500).optional(),
  }),
});

export const adminSetQuoteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    quotedTotal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Must be a number'),
    currency: z.string().length(3).optional(),
  }),
});

export const adminResolveEditSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    editId: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['approved', 'denied']),
    adminNote: z.string().max(1000).optional(),
  }),
});

export const adminPackageReplySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    body: z.string().min(1).max(5000),
    attachmentKey: z.string().max(500).optional(),
  }),
});
