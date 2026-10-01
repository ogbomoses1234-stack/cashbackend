import { z } from 'zod';

export const signupSchema = z.object({
  body: z.object({
    email: z.string().email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a symbol'),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  }),
});

export const resendOtpSchema = z.object({
  body: z.object({ email: z.string().email() }),
});

export const profileSetupSchema = z.object({
  body: z.object({
    fullName: z.string().min(3).max(120),
    phoneNumber: z.string().min(10).max(15),
    deliveryAddress: z.string().min(10).max(500),
  }),
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const adminVerifyOtpSchema = z.object({
  body: z.object({
    challengeId: z.string().uuid(),
    code: z.string().regex(/^\d{6}$/),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a symbol'),
  }),
});
