import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { TokenService } from './token.service';
import { ApiError } from '../utils/ApiError';
import { adminRedis } from '../config/redis';
import {
  ADMIN_MAX_FAILED_ATTEMPTS,
  ADMIN_LOCKOUT_MINUTES,
  ADMIN_SESSION_TTL_MINUTES,
} from '../config/constants';

export class AdminAuthService {
  /** STEP 1 — verify credentials, issue OTP. Returns a challenge id (not a session). */
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

  /** STEP 2 — verify OTP, then issue a short-lived admin access token. */
  static async verifyLoginOtp(opts: { challengeId: string; code: string }) {
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

    // Single active session per admin — overwrite previous
    const sessionId = randomUUID();
    await adminRedis.set(
      `admin_session:${authUser.profile.id}`,
      sessionId,
      'EX',
      ADMIN_SESSION_TTL_MINUTES * 60
    );

    const accessToken = TokenService.signAdminAccessToken({
      userId: authUser.profile.id,
      sessionId,
      ip: challenge.ip,
    });

    await adminRedis.del(`admin_challenge:${opts.challengeId}`);

    return {
      accessToken,
      admin: {
        id: authUser.profile.id,
        email: authUser.profile.email,
        fullName: authUser.profile.fullName,
      },
    };
  }

  static async logout(adminId: string) {
    await adminRedis.del(`admin_session:${adminId}`);
    return { loggedOut: true };
  }
}
