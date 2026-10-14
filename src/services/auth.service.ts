import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { TokenService } from './token.service';
import { ApiError } from '../utils/ApiError';
import { normalizeNgPhone } from '../utils/phoneFormat';
import { hashRefreshToken } from '../utils/hashRefreshToken';
import { logger } from '../config/logger';
import { LOGIN_MAX_FAILED_ATTEMPTS, LOGIN_LOCKOUT_MINUTES } from '../config/constants';

/* ═══════════════════════════════════════════════════
   Constants
═══════════════════════════════════════════════════ */
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/* ═══════════════════════════════════════════════════
   Session shape returned to controllers
═══════════════════════════════════════════════════ */
export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    fullName: string | null;
    emailVerified: boolean;
    mustChangePassword: boolean;
  };
}

export class AuthService {
  /* ═══════════════════════════════════════════════════
     SIGNUP
  ═══════════════════════════════════════════════════ */
  static async signup(opts: { email: string; password: string }) {
    const email = opts.email.toLowerCase().trim();

    const existing = await prisma.authUser.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('AUTH_EMAIL_TAKEN', 'This email is already registered');

    if (!PasswordService.isStrong(opts.password)) {
      throw ApiError.badRequest(
        'AUTH_WEAK_PASSWORD',
        'Password must be ≥8 chars with an uppercase letter, a number and a symbol'
      );
    }

    const passwordHash = await PasswordService.hash(opts.password);

    const authUser = await prisma.authUser.create({
      data: {
        email,
        passwordHash,
        profile: { create: { email, role: 'customer' } },
      },
    });

    const code = await OtpService.issue(authUser.id, 'signup');
    await EmailService.sendOtp(email, code, 'signup');

    return { authUserId: authUser.id, email };
  }

  static async verifySignupOtp(opts: { email: string; code: string }) {
    const email = opts.email.toLowerCase().trim();
    const authUser = await prisma.authUser.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!authUser) throw ApiError.badRequest('OTP_INVALID', 'Incorrect code. Try again.');

    await OtpService.consume(authUser.id, 'signup', opts.code);

    await prisma.userProfile.update({
      where: { authUserId: authUser.id },
      data: { emailVerified: true },
    });

    return { verified: true };
  }

  /* ═══════════════════════════════════════════════════
     LOGIN
  ═══════════════════════════════════════════════════ */
  static async login(opts: {
    email: string;
    password: string;
    fingerprintHash?: string;
    ip: string;
    userAgent?: string;
  }): Promise<SessionResult> {
    const email = opts.email.toLowerCase().trim();
    const authUser = await prisma.authUser.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!authUser?.profile) {
      throw ApiError.unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (opts.fingerprintHash) {
      const blocked = await prisma.userDevice.findFirst({
        where: { fingerprintHash: opts.fingerprintHash, blocked: true },
      });
      if (blocked) throw ApiError.forbidden('AUTH_DEVICE_BLOCKED', 'Access denied');
    }

    if (!authUser.profile.isActive) {
      throw ApiError.forbidden('AUTH_ACCOUNT_DEACTIVATED', 'Account suspended. Contact support.');
    }

    if (authUser.lockedUntil && authUser.lockedUntil > new Date()) {
      throw ApiError.forbidden('AUTH_LOCKED', 'Account temporarily locked');
    }

    const ok = await PasswordService.verify(opts.password, authUser.passwordHash);
    if (!ok) {
      const attempts = authUser.failedAttempts + 1;
      const lockUntil =
        attempts >= LOGIN_MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60_000)
          : null;

      await prisma.authUser.update({
        where: { id: authUser.id },
        data: { failedAttempts: attempts, lockedUntil: lockUntil },
      });
      throw ApiError.unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await prisma.authUser.update({
      where: { id: authUser.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    if (opts.fingerprintHash) {
      await prisma.userDevice.upsert({
        where: {
          userId_fingerprintHash: {
            userId: authUser.profile.id,
            fingerprintHash: opts.fingerprintHash,
          },
        },
        create: {
          userId: authUser.profile.id,
          fingerprintHash: opts.fingerprintHash,
          ipAddress: opts.ip,
          userAgent: opts.userAgent,
        },
        update: { lastSeenAt: new Date(), ipAddress: opts.ip },
      });
    }

    return this.issueSession({
      userId: authUser.profile.id,
      authId: authUser.id,
      role: authUser.profile.role as any,
      ip: opts.ip,
      userAgent: opts.userAgent,
    });
  }

  /**
   * Auto-login after OTP verification.
   * Returns the user + tokens — the controller sets cookies.
   */
  static async issueSessionAfterSignup(opts: {
    email: string;
    ip?: string;
    userAgent?: string;
  }): Promise<SessionResult> {
    const email = opts.email.toLowerCase().trim();
    const authUser = await prisma.authUser.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!authUser?.profile) {
      throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
    }

    return this.issueSession({
      userId: authUser.profile.id,
      authId: authUser.id,
      role: authUser.profile.role as any,
      ip: opts.ip ?? '',
      userAgent: opts.userAgent,
    });
  }

  /* ═══════════════════════════════════════════════════
     CORE — issue a fresh session (access + refresh)
  ═══════════════════════════════════════════════════ */
  static async issueSession(opts: {
    userId: string;
    authId: string;
    role: string;
    ip: string;
    userAgent?: string;
  }): Promise<SessionResult> {
    const accessToken = TokenService.signPublicAccessToken({
      userId: opts.userId,
      authId: opts.authId,
      role: opts.role as any,
    });

    const jti = randomUUID();
    const familyId = randomUUID();
    const refreshToken = TokenService.signPublicRefreshToken({
      userId: opts.userId,
      jti,
      familyId,
    });

    await prisma.refreshToken.create({
      data: {
        userId: opts.userId,
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        userAgent: opts.userAgent,
        ipAddress: opts.ip,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    const profile = await prisma.userProfile.findUniqueOrThrow({
      where: { id: opts.userId },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        emailVerified: true,
        mustChangePassword: true,
      },
    });

    return { accessToken, refreshToken, user: profile };
  }

  /* ═══════════════════════════════════════════════════
     REFRESH — rotate token, issue new access
  ═══════════════════════════════════════════════════ */
  static async refreshSession(opts: {
    refreshToken: string;
    ip: string;
    userAgent?: string;
  }): Promise<SessionResult> {
    const payload = TokenService.verifyPublicRefreshToken(opts.refreshToken);
    if (!payload) {
      throw ApiError.unauthorized('REFRESH_INVALID', 'Session expired. Please log in again.');
    }

    const hash = hashRefreshToken(opts.refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

    /* ─── Unknown token → could be forged ─── */
    if (!stored) {
      logger.warn('refresh: token not found in DB', { familyId: payload.familyId });
      await prisma.refreshToken.updateMany({
        where: { familyId: payload.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized('REFRESH_INVALID', 'Session expired. Please log in again.');
    }

    /* ─── Reuse detection — token was already rotated ─── */
    if (stored.revokedAt) {
      logger.warn('refresh: reuse detected — killing family', {
        familyId: stored.familyId,
        userId: stored.userId,
      });
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized('REFRESH_REUSED', 'Session revoked for security. Log in again.');
    }

    /* ─── Expiry check (defensive — JWT already checked) ─── */
    if (stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('REFRESH_EXPIRED', 'Session expired. Please log in again.');
    }

    /* ─── User still active? ─── */
    const profile = await prisma.userProfile.findUnique({
      where: { id: stored.userId },
    });
    if (!profile) {
      throw ApiError.unauthorized('USER_NOT_FOUND', 'Account not found');
    }
    if (!profile.isActive) {
      throw ApiError.forbidden('AUTH_ACCOUNT_DEACTIVATED', 'Account suspended');
    }

    /* ─── Rotate: revoke old, issue new in same family ─── */
    const newJti = randomUUID();
    const newRefreshToken = TokenService.signPublicRefreshToken({
      userId: profile.id,
      jti: newJti,
      familyId: stored.familyId,
    });
    const newHash = hashRefreshToken(newRefreshToken);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedBy: newJti },
      }),
      prisma.refreshToken.create({
        data: {
          userId: profile.id,
          tokenHash: newHash,
          familyId: stored.familyId,
          userAgent: opts.userAgent,
          ipAddress: opts.ip,
          expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        },
      }),
    ]);

    const accessToken = TokenService.signPublicAccessToken({
      userId: profile.id,
      authId: profile.authUserId,
      role: profile.role as any,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        fullName: profile.fullName,
        emailVerified: profile.emailVerified,
        mustChangePassword: profile.mustChangePassword,
      },
    };
  }

  /* ═══════════════════════════════════════════════════
     LOGOUT — revoke access + current refresh family
  ═══════════════════════════════════════════════════ */
  static async logout(opts: { jti?: string; refreshToken?: string }) {
    if (opts.jti) {
      await TokenService.revokePublic(opts.jti, 900);
    }

    if (opts.refreshToken) {
      const hash = hashRefreshToken(opts.refreshToken);
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
      if (stored) {
        await prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    return { loggedOut: true };
  }

  /* ═══════════════════════════════════════════════════
     OTP / PROFILE
  ═══════════════════════════════════════════════════ */
  static async resendOtp(email: string, purpose: 'signup' | 'password_reset' = 'signup') {
    const authUser = await prisma.authUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!authUser) return { sent: true };
    const code = await OtpService.issue(authUser.id, purpose);
    await EmailService.sendOtp(authUser.email, code, purpose);
    return { sent: true };
  }

  static async completeProfile(opts: {
    userId: string;
    fullName: string;
    phoneNumber: string;
    deliveryAddress: string;
  }) {
    const { userId } = opts;
    const fullName = opts.fullName.trim();
    const deliveryAddress = opts.deliveryAddress.trim();

    if (fullName.length < 3) throw ApiError.badRequest('PROFILE_INVALID_NAME', 'Full name is too short');
    if (deliveryAddress.length < 10) throw ApiError.badRequest('PROFILE_INVALID_ADDRESS', 'Address is too short');

    const normalized = normalizeNgPhone(opts.phoneNumber);
    if (!normalized) throw ApiError.badRequest('PROFILE_INVALID_PHONE', 'Enter a valid Nigerian phone number');

    const conflict = await prisma.userProfile.findFirst({
      where: { phoneNumber: normalized, NOT: { id: userId } },
    });
    if (conflict) throw ApiError.conflict('PROFILE_PHONE_TAKEN', 'Phone number already in use');

    return prisma.userProfile.update({
      where: { id: userId },
      data: { fullName, phoneNumber: normalized, deliveryAddress },
    });
  }

  /* ═══════════════════════════════════════════════════
     CHANGE PASSWORD — nukes ALL sessions (security)
  ═══════════════════════════════════════════════════ */
  static async changePassword(opts: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: opts.userId },
      include: { authUser: true },
    });
    if (!profile) throw ApiError.notFound('USER_NOT_FOUND', 'User not found');

    const ok = await PasswordService.verify(opts.currentPassword, profile.authUser.passwordHash);
    if (!ok) throw ApiError.badRequest('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect');

    if (!PasswordService.isStrong(opts.newPassword)) {
      throw ApiError.badRequest(
        'AUTH_WEAK_PASSWORD',
        'Password must be ≥8 chars with an uppercase letter, a number and a symbol'
      );
    }

    if (opts.currentPassword === opts.newPassword) {
      throw ApiError.badRequest('AUTH_SAME_PASSWORD', 'New password must be different from the current one');
    }

    const newHash = await PasswordService.hash(opts.newPassword);

    await prisma.$transaction([
      prisma.authUser.update({
        where: { id: profile.authUserId },
        data: { passwordHash: newHash, failedAttempts: 0, lockedUntil: null },
      }),
      prisma.userProfile.update({
        where: { id: opts.userId },
        data: { mustChangePassword: false },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: opts.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { changed: true };
  }
}