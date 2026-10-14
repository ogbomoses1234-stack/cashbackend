import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthService } from '../../services/auth.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../config/database';
import { config } from '../../config';

/* ═══════════════════════════════════════════════════
   Cookie helpers
═══════════════════════════════════════════════════ */
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

function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_COOKIE, token, {
    ...cookieBase(),
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieBase(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/public/auth',
  });
}

function clearAuthCookies(res: Response) {
  const base = cookieBase();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/public/auth' });
}

/* ═══════════════════════════════════════════════════
   SIGNUP
═══════════════════════════════════════════════════ */
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.signup(req.body);
  await AuditLogService.record({
    event: 'auth.signup',
    entityType: 'user',
    entityId: result.authUserId,
    ipAddress: req.ip,
  });
  return ApiResponse.success(res, result, 'Check your email for the verification code', 201);
});

/* ═══════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════ */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.login({
    email: req.body.email,
    password: req.body.password,
    fingerprintHash: req.fingerprintHash,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  setAccessCookie(res, result.accessToken);
  setRefreshCookie(res, result.refreshToken);

  await AuditLogService.record({
    actorId: result.user.id,
    actorRole: result.user.role as any,
    event: 'auth.login',
    ipAddress: req.ip,
    fingerprint: req.fingerprintHash,
  });

  return ApiResponse.success(res, result, 'Logged in');
});

/* ═══════════════════════════════════════════════════
   REFRESH — rotate + issue new pair
═══════════════════════════════════════════════════ */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken: string | undefined =
    req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE];

  if (!refreshToken) {
    throw ApiError.unauthorized('REFRESH_MISSING', 'No refresh token provided');
  }

  const result = await AuthService.refreshSession({
    refreshToken,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  setAccessCookie(res, result.accessToken);
  setRefreshCookie(res, result.refreshToken);

  return ApiResponse.success(res, result, 'Session refreshed');
});

/* ═══════════════════════════════════════════════════
   LOGOUT
═══════════════════════════════════════════════════ */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken: string | undefined =
    req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE];

  await AuthService.logout({
    jti: req.user?.jti,
    refreshToken,
  });

  clearAuthCookies(res);
  return ApiResponse.success(res, { loggedOut: true });
});

/* ═══════════════════════════════════════════════════
   ME
═══════════════════════════════════════════════════ */
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const profile = await prisma.userProfile.findUnique({
    where: { id: req.user.sub },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      phoneNumber: true,
      deliveryAddress: true,
      emailVerified: true,
      mustChangePassword: true,
      walletBalance: true,
      pendingBalance: true,
      totalEarned: true,
      staffCode: true,
      salesPoint: true,
    },
  });
  if (!profile) throw ApiError.notFound();
  return ApiResponse.success(res, profile);
});

export const completeProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await AuthService.completeProfile({ userId: req.user.sub, ...req.body });
  return ApiResponse.success(res, result, 'Profile saved');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const result = await AuthService.changePassword({
    userId: req.user.sub,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });
  clearAuthCookies(res);
  return ApiResponse.success(res, result, 'Password changed. Please log in again.');
});