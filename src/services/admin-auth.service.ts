import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { TokenService } from './token.service';
import { ApiError } from '../utils/ApiError';
import { adminRedis } from '../config/redis';
import { hashRefreshToken } from '../utils/hashRefreshToken';
import { logger } from '../config/logger';
import {
  ADMIN_MAX_FAILED_ATTEMPTS,
  ADMIN_LOCKOUT_MINUTES,
  ADMIN_SESSION_TTL_MINUTES,
} from '../config/constants';

/* Admin refresh token TTL: 7 days */
const ADMIN_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'admin';
  createdAt: string;
}

export interface AdminSessionResult {
  accessToken: string;
  refreshToken: string;
  admin: AdminProfile;
}

export class AdminAuthService {
  /* ═══════════════════════════════════════════════════
     STEP 1 — verify credentials, issue OTP
  ═══════════════════════════════════════════════════ */
  static async beginLogin(opts: { email: string; password: string; ip: string }) {
    const email = opts.email.toLowerCase().trim();
    const authUser = await prisma.authUser.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!authUser?.profile || authUser.profile.role !== 'admin') {
      throw ApiError.unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (authUser.lockedUntil && authUser.lockedUntil > new Date()) {
      throw ApiError.forbidden('ADMIN_LOCKED', 'Account temporarily locked');
    }

    const ok = await PasswordService.verify(opts.password, authUser.passwordHash);
    if (!ok) {
      const attempts = authUser.failedAttempts + 1;
      const lockUntil =
        attempts >= ADMIN_MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + ADMIN_LOCKOUT_MINUTES * 60_000)
          : null;

      await prisma.authUser.update({
        where: { id: authUser.id },
        data: { failedAttempts: attempts, lockedUntil: lockUntil },
      });
      throw ApiError.unauthorized('AUTH_INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const code = await OtpService.issue(authUser.id, 'admin_login');
    await EmailService.sendOtp(authUser.email, code, 'admin_login');

    const challengeId = randomUUID();
    await adminRedis.set(
      `admin_challenge:${challengeId}`,
      JSON.stringify({ authUserId: authUser.id, ip: opts.ip, ts: Date.now() }),
      'EX',
      300
    );

    return { challengeId, email: authUser.email };
  }

  /* ═══════════════════════════════════════════════════
     STEP 2 — verify OTP, issue access + refresh
  ═══════════════════════════════════════════════════ */
  static async verifyLoginOtp(opts: {
    challengeId: string;
    code: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AdminSessionResult> {
    const raw = await adminRedis.get(`admin_challenge:${opts.challengeId}`);
    if (!raw) {
      throw ApiError.badRequest('ADMIN_CHALLENGE_EXPIRED', 'Login session expired. Start over.');
    }
    const challenge = JSON.parse(raw) as { authUserId: string; ip: string; ts: number };

    await OtpService.consume(challenge.authUserId, 'admin_login', opts.code);

    const authUser = await prisma.authUser.findUnique({
      where: { id: challenge.authUserId },
      include: { profile: true },
    });
    if (!authUser?.profile) throw ApiError.notFound();

    await prisma.authUser.update({
      where: { id: authUser.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const session = await this.issueAdminSession({
      userId: authUser.profile.id,
      ip: opts.ip ?? challenge.ip,
      userAgent: opts.userAgent,
    });

    await adminRedis.del(`admin_challenge:${opts.challengeId}`);
    return session;
  }

  /* ═══════════════════════════════════════════════════
     CORE — issue fresh access + refresh + Redis session
  ═══════════════════════════════════════════════════ */
  private static async issueAdminSession(opts: {
    userId: string;
    ip: string;
    userAgent?: string;
  }): Promise<AdminSessionResult> {
    /* Single active session per admin — overwrite Redis key */
    const sessionId = randomUUID();
    await adminRedis.set(
      `admin_session:${opts.userId}`,
      sessionId,
      'EX',
      ADMIN_SESSION_TTL_MINUTES * 60
    );

    const accessToken = TokenService.signAdminAccessToken({
      userId: opts.userId,
      sessionId,
      ip: opts.ip,
    });

    const jti = randomUUID();
    const familyId = randomUUID();
    const refreshToken = TokenService.signAdminRefreshToken({
      userId: opts.userId,
      jti,
      familyId,
      ip: opts.ip,
    });

    await prisma.refreshToken.create({
      data: {
        userId: opts.userId,
        tokenHash: hashRefreshToken(refreshToken),
        familyId,
        userAgent: opts.userAgent,
        ipAddress: opts.ip,
        expiresAt: new Date(Date.now() + ADMIN_REFRESH_TTL_MS),
      },
    });

    const profile = await prisma.userProfile.findUniqueOrThrow({
      where: { id: opts.userId },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName ?? 'Admin',
        role: 'admin',
        createdAt: profile.createdAt.toISOString(),
      },
    };
  }

  /* ═══════════════════════════════════════════════════
     REFRESH — rotate + reissue Redis session
  ═══════════════════════════════════════════════════ */
  static async refreshSession(opts: {
    refreshToken: string;
    ip: string;
    userAgent?: string;
  }): Promise<AdminSessionResult> {
    const payload = TokenService.verifyAdminRefreshToken(opts.refreshToken);
    if (!payload) {
      throw ApiError.unauthorized('REFRESH_INVALID', 'Session expired. Please log in again.');
    }

    const hash = hashRefreshToken(opts.refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });

    /* Unknown → kill the family */
    if (!stored) {
      logger.warn('admin refresh: token not found in DB', { familyId: payload.familyId });
      await prisma.refreshToken.updateMany({
        where: { familyId: payload.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized('REFRESH_INVALID', 'Session expired. Please log in again.');
    }

    /* Reuse detected */
    if (stored.revokedAt) {
      logger.warn('admin refresh: reuse detected — killing family', {
        familyId: stored.familyId,
        userId: stored.userId,
      });
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized('REFRESH_REUSED', 'Session revoked for security. Log in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('REFRESH_EXPIRED', 'Session expired. Please log in again.');
    }

    /* Verify user still an active admin */
    const profile = await prisma.userProfile.findUnique({
      where: { id: stored.userId },
    });
    if (!profile || profile.role !== 'admin') {
      throw ApiError.unauthorized('NOT_ADMIN', 'Account no longer has admin access');
    }
    if (!profile.isActive) {
      throw ApiError.forbidden('AUTH_ACCOUNT_DEACTIVATED', 'Account suspended');
    }

    /* New Redis session (single session per admin) */
    const newSessionId = randomUUID();
    await adminRedis.set(
      `admin_session:${profile.id}`,
      newSessionId,
      'EX',
      ADMIN_SESSION_TTL_MINUTES * 60
    );

    /* Rotate refresh token in same family */
    const newJti = randomUUID();
    const newRefreshToken = TokenService.signAdminRefreshToken({
      userId: profile.id,
      jti: newJti,
      familyId: stored.familyId,
      ip: opts.ip,
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
          expiresAt: new Date(Date.now() + ADMIN_REFRESH_TTL_MS),
        },
      }),
    ]);

    const accessToken = TokenService.signAdminAccessToken({
      userId: profile.id,
      sessionId: newSessionId,
      ip: opts.ip,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      admin: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName ?? 'Admin',
        role: 'admin',
        createdAt: profile.createdAt.toISOString(),
      },
    };
  }

  /* ═══════════════════════════════════════════════════
     LOGOUT — clear Redis session + revoke refresh family
  ═══════════════════════════════════════════════════ */
  static async logout(opts: { adminId: string; refreshToken?: string }) {
    await adminRedis.del(`admin_session:${opts.adminId}`);

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
}