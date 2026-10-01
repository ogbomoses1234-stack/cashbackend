import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AdminAuthService } from '../../services/admin-auth.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';
import { config } from '../../config';

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

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const result = await AdminAuthService.verifyLoginOtp({
    challengeId: req.body.challengeId,
    code: req.body.code,
  });

  res.cookie('adminAccessToken', result.accessToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/',
    ...(config.isProd
      ? {
          domain:
            '.' +
            config.domains.admin.replace(/^https?:\/\//, '').split('/')[0],
        }
      : {}),
  });

  await AuditLogService.record({
    actorId: result.admin.id,
    actorRole: 'admin',
    event: 'admin.login.success',
    ipAddress: req.ip,
  });

  return ApiResponse.success(res, result, 'Admin session started');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.admin) await AdminAuthService.logout(req.admin.sub);
  res.clearCookie('adminAccessToken');
  return ApiResponse.success(res, { loggedOut: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.admin) throw ApiError.unauthorized('ADMIN_AUTH_REQUIRED', 'Admin required');
  return ApiResponse.success(res, { id: req.admin.sub, role: 'admin' });
});
