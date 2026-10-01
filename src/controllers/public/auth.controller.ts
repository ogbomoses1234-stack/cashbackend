import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { AuthService } from '../../services/auth.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ApiError } from '../../utils/ApiError';
import { prisma } from '../../config/database';
import { config } from '../../config';

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

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.login({
    email: req.body.email,
    password: req.body.password,
    fingerprintHash: req.fingerprintHash,
    ip: req.ip || '',
    userAgent: req.headers['user-agent'],
  });

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
    ...(config.isProd
      ? {
          domain:
            '.' +
            config.domains.public.replace(/^https?:\/\//, '').split('/')[0],
        }
      : {}),
  });

  await AuditLogService.record({
    actorId: result.user.id,
    actorRole: result.user.role as any,
    event: 'auth.login',
    ipAddress: req.ip,
    fingerprint: req.fingerprintHash,
  });

  return ApiResponse.success(res, result, 'Logged in');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.jti) await AuthService.logout(req.user.jti);
  res.clearCookie('accessToken');
  return ApiResponse.success(res, { loggedOut: true });
});

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
  return ApiResponse.success(res, result, 'Password changed');
});
