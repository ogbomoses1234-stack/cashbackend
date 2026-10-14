import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthService } from '../../services/auth.service';
import { config } from '../../config';

const ACCESS_COOKIE = 'accessToken';
const REFRESH_COOKIE = 'refreshToken';

function cookieBase() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: (config.isProd ? 'none' : 'lax') as 'none' | 'lax',
    ...(config.isProd
      ? { domain: '.' + config.domains.public.replace(/^https?:\/\//, '').split('/')[0] }
      : {}),
  };
}

/* ═══════════════════════════════════════════════════
   POST /api/public/otp/verify
   Verifies the signup OTP AND issues a session cookie
   so the frontend doesn't have to cache the password.
═══════════════════════════════════════════════════ */
export const verifySignupOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, code } = req.body;

  /* 1. Verify the OTP */
  await AuthService.verifySignupOtp({ email, code });

  /* 2. Auto-login — issue access + refresh tokens */
  const session = await AuthService.issueSessionAfterSignup({
    email,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  res.cookie(ACCESS_COOKIE, session.accessToken, {
    ...cookieBase(),
    maxAge: 15 * 60 * 1000,
    path: '/',
  });

  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    ...cookieBase(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/public/auth',
  });

  return ApiResponse.success(
    res,
    {
      verified: true,
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    },
    'Email verified'
  );
});

export const resendOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.resendOtp(req.body.email, 'signup');
  return ApiResponse.success(res, result, 'If that email exists, a code has been sent');
});