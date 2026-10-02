import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthService } from '../../services/auth.service';
import { config } from '../../config';

/* ═══════════════════════════════════════════════════════════
   POST /api/public/otp/verify
   Verifies the signup OTP AND issues a session cookie so the
   frontend doesn't have to cache the password.
═══════════════════════════════════════════════════════════ */
export const verifySignupOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;

  /* 1. Verify the OTP */
  await AuthService.verifySignupOtp({ email, code });

  /* 2. Auto-login — issue the session cookie */
  const session = await AuthService.issueSessionAfterSignup({ email });

  res.cookie('accessToken', session.accessToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
    ...(config.isProd ? { domain: '.' + config.domains.public.replace(/^https?:\/\//, '').split('/')[0] } : {}),
  });

  return ApiResponse.success(
    res,
    { verified: true, user: session.user, accessToken: session.accessToken },
    'Email verified'
  );
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.resendOtp(req.body.email, 'signup');
  return ApiResponse.success(res, result, 'If that email exists, a code has been sent');
});
