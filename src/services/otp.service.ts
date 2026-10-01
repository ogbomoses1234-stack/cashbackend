import { prisma } from '../config/database';
import { generateOtpCode, hashOtp, verifyOtpHash } from '../utils/hashOtp';
import { config } from '../config';
import { ApiError } from '../utils/ApiError';

type Purpose = 'signup' | 'login' | 'admin_login' | 'password_reset';

export class OtpService {
  /** Issue a new OTP for the given auth user. Invalidates older same-purpose tokens. */
  static async issue(authUserId: string, purpose: Purpose): Promise<string> {
    await prisma.otpToken.updateMany({
      where: { userId: authUserId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtpCode();
    const codeHash = await hashOtp(code);
    const expiresAt = new Date(Date.now() + config.business.otpTtlMinutes * 60_000);

    await prisma.otpToken.create({
      data: { userId: authUserId, codeHash, purpose, expiresAt },
    });

    return code;
  }

  /** Verify + consume the latest unconsumed OTP for (authUserId, purpose). */
  static async consume(authUserId: string, purpose: Purpose, code: string): Promise<void> {
    const token = await prisma.otpToken.findFirst({
      where: { userId: authUserId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) throw ApiError.badRequest('OTP_INVALID', 'Incorrect code. Try again.');
    if (token.expiresAt < new Date())
      throw ApiError.badRequest('OTP_EXPIRED', 'Code expired. Request a new one.');
    if (token.attempts >= config.business.otpMaxAttempts) {
      throw ApiError.tooMany('OTP_MAX_ATTEMPTS', 'Too many attempts. Wait 15 minutes.');
    }

    const ok = await verifyOtpHash(code, token.codeHash);
    if (!ok) {
      await prisma.otpToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw ApiError.badRequest('OTP_INVALID', 'Incorrect code. Try again.');
    }

    await prisma.otpToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
  }
}
