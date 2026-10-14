import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AdminAuthService } from '../../services/admin-auth.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';
import { config } from '../../config';

/* ═══════════════════════════════════════════════════
   Cookie helpers
═══════════════════════════════════════════════════ */
const ACCESS_COOKIE = 'adminAccessToken';
const REFRESH_COOKIE = 'adminRefreshToken';

function cookieBase() {
  return {
    httpOnly: true,
    secure: config.isProd,
    sameSite: (config.isProd ? 'none' : 'lax') as 'none' | 'lax',
    ...(config.isProd
      ? { domain: '.' + config.domains.admin.replace(/^https?:\/\//, '').split('/')[0] }
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
    path: '/api/admin/auth',
  });
}

function clearAuthCookies(res: Response) {
  const base = cookieBase();
  res.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/admin/auth' });
}

/* ═══════════════════════════════════════════════════
   STEP 1 — begin login
═══════════════════════════════════════════════════ */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AdminAuthService.beginLogin({
    email: req.body.email,
    password: req.body.password,
    ip: req.ip || '',
  });

  await AuditLogService.record({
    event: 'admin.login.begin',
    entityType: 'admin',
    entityId: result.email,
    ipAddress: req.ip,
  });

  return ApiResponse.success(res, result, 'OTP sent to your email');
});

/* ═══════════════════════════════════════════════════
   STEP 2 — verify OTP → issue tokens + cookies
═══════════════════════════════════════════════════ */
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await AdminAuthService.verifyLoginOtp({
    challengeId: req.body.challengeId,
    code: req.body.code,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  setAccessCookie(res, result.accessToken);
  setRefreshCookie(res, result.refreshToken);

  await AuditLogService.record({
    actorId: result.admin.id,
    actorRole: 'admin',
    event: 'admin.login.success',
    ipAddress: req.ip,
  });

  return ApiResponse.success(res, result, 'Admin session started');
});

/* ═══════════════════════════════════════════════════
   REFRESH — rotate access + refresh + Redis session
═══════════════════════════════════════════════════ */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken: string | undefined =
    req.body?.refreshToken || req.cookies?.[REFRESH_COOKIE];

  if (!refreshToken) {
    throw ApiError.unauthorized('REFRESH_MISSING', 'No refresh token provided');
  }

  const result = await AdminAuthService.refreshSession({
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

  if (req.admin) {
    await AdminAuthService.logout({
      adminId: req.admin.sub,
      refreshToken,
    });
  }

  clearAuthCookies(res);
  return ApiResponse.success(res, { loggedOut: true });
});

/* ═══════════════════════════════════════════════════
   ME
═══════════════════════════════════════════════════ */
export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  return ApiResponse.success(res, { id: req.admin.sub, role: 'admin' });
});