import { z } from 'zod';

export const createThreadSchema = z.object({
  body: z.object({
    subject: z.string().min(3).max(200),
    body: z.string().min(1).max(5000),
    attachmentKey: z.string().max(500).optional(),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    body: z.string().min(1).max(5000),
    attachmentKey: z.string().max(500).optional(),
  }),
});

export const threadIdParams = z.object({
  params: z.object({ id: z.string().uuid() }),
});
