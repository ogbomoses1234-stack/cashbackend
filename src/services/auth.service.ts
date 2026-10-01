import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { OtpService } from './otp.service';
import { EmailService } from './email.service';
import { TokenService } from './token.service';
import { ApiError } from '../utils/ApiError';
import { normalizeNgPhone } from '../utils/phoneFormat';
import { LOGIN_MAX_FAILED_ATTEMPTS, LOGIN_LOCKOUT_MINUTES } from '../config/constants';

export class AuthService {
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
        profile: {
          create: { email, role: 'customer' },
        },
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

  static async login(opts: {
    email: string;
    password: string;
    fingerprintHash?: string;
    ip: string;
    userAgent?: string;
  }) {
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

    const accessToken = TokenService.signPublicAccessToken({
      userId: authUser.profile.id,
      authId: authUser.id,
      role: authUser.profile.role as any,
    });

    return {
      accessToken,
      user: {
        id: authUser.profile.id,
        email: authUser.profile.email,
        role: authUser.profile.role,
        fullName: authUser.profile.fullName,
        emailVerified: authUser.profile.emailVerified,
        mustChangePassword: authUser.profile.mustChangePassword,
      },
    };
  }

  static async resendOtp(email: string, purpose: 'signup' | 'password_reset' = 'signup') {
    const authUser = await prisma.authUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!authUser) return { sent: true }; // prevent email enumeration

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

    if (fullName.length < 3) {
      throw ApiError.badRequest('PROFILE_INVALID_NAME', 'Full name is too short');
    }
    if (deliveryAddress.length < 10) {
      throw ApiError.badRequest('PROFILE_INVALID_ADDRESS', 'Address is too short');
    }

    const normalized = normalizeNgPhone(opts.phoneNumber);
    if (!normalized) {
      throw ApiError.badRequest('PROFILE_INVALID_PHONE', 'Enter a valid Nigerian phone number');
    }

    const conflict = await prisma.userProfile.findFirst({
      where: { phoneNumber: normalized, NOT: { id: userId } },
    });
    if (conflict) throw ApiError.conflict('PROFILE_PHONE_TAKEN', 'Phone number already in use');

    return prisma.userProfile.update({
      where: { id: userId },
      data: { fullName, phoneNumber: normalized, deliveryAddress },
    });
  }

  static async logout(jti: string) {
    await TokenService.revokePublic(jti, 900);
    return { loggedOut: true };
  }

  /**
   * Change password for any authenticated user (customer, staff, admin).
   * Verifies the old password, validates the new one, updates the hash,
   * and clears `mustChangePassword`.
   */
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

    const ok = await PasswordService.verify(
      opts.currentPassword,
      profile.authUser.passwordHash
    );
    if (!ok) {
      throw ApiError.badRequest(
        'AUTH_INVALID_CREDENTIALS',
        'Current password is incorrect'
      );
    }

    if (!PasswordService.isStrong(opts.newPassword)) {
      throw ApiError.badRequest(
        'AUTH_WEAK_PASSWORD',
        'Password must be ≥8 chars with an uppercase letter, a number and a symbol'
      );
    }

    if (opts.currentPassword === opts.newPassword) {
      throw ApiError.badRequest(
        'AUTH_SAME_PASSWORD',
        'New password must be different from the current one'
      );
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
    ]);

    return { changed: true };
  }

  /**
   * Auto-login after OTP verification.
   * Returns the user + access token — the controller sets the cookie.
   * The frontend never has to store the password client-side.
   */
  static async issueSessionAfterSignup(opts: { email: string }) {
    const email = opts.email.toLowerCase().trim();
    const authUser = await prisma.authUser.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!authUser?.profile) {
      throw ApiError.notFound('USER_NOT_FOUND', 'User not found');
    }

    const token = TokenService.signPublicAccessToken({
      userId: authUser.profile.id,
      authId: authUser.id,
      role: authUser.profile.role as any,
    });

    return {
      accessToken: token,
      user: {
        id: authUser.profile.id,
        email: authUser.profile.email,
        role: authUser.profile.role,
        fullName: authUser.profile.fullName,
        emailVerified: authUser.profile.emailVerified,
        mustChangePassword: authUser.profile.mustChangePassword,
      },
    };
  }
}
