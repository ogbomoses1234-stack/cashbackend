import { z } from 'zod';

export const updateNotificationPrefsSchema = z.object({
  body: z.object({
    order: z.boolean().optional(),
    package: z.boolean().optional(),
    withdrawal: z.boolean().optional(),
    email: z
      .union([z.string().email('Enter a valid email address'), z.literal('')])
      .optional(),
  }),
});