import { z } from 'zod';

export const scanRedeemSchema = z.object({
  body: z.object({
    serialNumber: z.string().min(6).max(24),
    // Optional: legacy QRs (generated before sig-in-URL) don't include this.
    // Verify the sig when present; accept the request when missing (dev mode).
    sig: z.string().max(64).optional().or(z.literal('')),
  }),
});

export const staffScanSchema = z.object({
  body: z.object({
    serialNumber: z.string().min(6).max(24),
    // Optional: legacy QRs (generated before sig-in-URL) don't include this.
    // Verify the sig when present; accept the request when missing (dev mode).
    sig: z.string().max(64).optional().or(z.literal('')),
  }),
});
