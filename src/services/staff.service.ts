import { prisma } from '../config/database';
import { PasswordService } from './password.service';
import { EmailService } from './email.service';
import { generateStaffCode } from '../utils/generateSerial';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';
import { normalizeNgPhone } from '../utils/phoneFormat';

export class StaffService {
  static async list(opts: { search?: string; page?: number; perPage?: number } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });
    const where: any = { role: 'staff' };
    if (opts.search) {
      where.OR = [
        { fullName: { contains: opts.search, mode: 'insensitive' } },
        { email: { contains: opts.search, mode: 'insensitive' } },
        { staffCode: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          salesPoint: true,
          staffCode: true,
          isActive: true,
          createdAt: true,
        },
        skip,
        take,
      }),
      prisma.userProfile.count({ where }),
    ]);
    return { items, meta: { page, perPage, total } };
  }

  static async create(opts: {
    fullName: string;
    email: string;
    phoneNumber: string;
    salesPoint: string;
    tempPassword?: string;
  }) {
    const email = opts.email.toLowerCase().trim();
    const existing = await prisma.authUser.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('STAFF_EMAIL_TAKEN', 'Email already in use');

    const phone = normalizeNgPhone(opts.phoneNumber);
    if (!phone) throw ApiError.badRequest('STAFF_INVALID_PHONE', 'Enter a valid Nigerian phone number');

    const tempPassword = opts.tempPassword || PasswordService.generateTempPassword();
    if (!PasswordService.isStrong(tempPassword)) {
      throw ApiError.badRequest('STAFF_WEAK_PASSWORD', 'Temporary password is too weak');
    }
    const hash = await PasswordService.hash(tempPassword);

    const created = await prisma.authUser.create({
      data: {
        email,
        passwordHash: hash,
        profile: {
          create: {
            email,
            role: 'staff',
            fullName: opts.fullName.trim(),
            phoneNumber: phone,
            salesPoint: opts.salesPoint.trim(),
            staffCode: generateStaffCode(),
            emailVerified: true,
            mustChangePassword: true,
          },
        },
      },
      include: { profile: true },
    });

    EmailService.sendStaffCredentials(email, opts.fullName, tempPassword).catch(() => {});

    return {
      id: created.profile!.id,
      email,
      staffCode: created.profile!.staffCode,
      tempPassword,
    };
  }

  static async update(
    staffId: string,
    data: Partial<{ fullName: string; phoneNumber: string; salesPoint: string }>
  ) {
    const staff = await prisma.userProfile.findFirst({
      where: { id: staffId, role: 'staff' },
    });
    if (!staff) throw ApiError.notFound('STAFF_NOT_FOUND', 'Staff not found');

    const patch: any = {};
    if (data.fullName) patch.fullName = data.fullName.trim();
    if (data.phoneNumber) {
      const phone = normalizeNgPhone(data.phoneNumber);
      if (!phone) throw ApiError.badRequest('STAFF_INVALID_PHONE', 'Invalid phone number');
      patch.phoneNumber = phone;
    }
    if (data.salesPoint) patch.salesPoint = data.salesPoint.trim();

    return prisma.userProfile.update({ where: { id: staffId }, data: patch });
  }

  static async resetPassword(staffId: string) {
    const staff = await prisma.userProfile.findFirst({
      where: { id: staffId, role: 'staff' },
      include: { authUser: true },
    });
    if (!staff) throw ApiError.notFound();

    const tempPassword = PasswordService.generateTempPassword();
    const hash = await PasswordService.hash(tempPassword);

    await prisma.$transaction([
      prisma.authUser.update({
        where: { id: staff.authUserId },
        data: { passwordHash: hash, failedAttempts: 0, lockedUntil: null },
      }),
      prisma.userProfile.update({
        where: { id: staffId },
        data: { mustChangePassword: true },
      }),
    ]);

    EmailService.sendStaffCredentials(
      staff.email,
      staff.fullName || 'Seller',
      tempPassword
    ).catch(() => {});

    return { tempPassword };
  }

  static async deactivate(staffId: string) {
    const staff = await prisma.userProfile.findFirst({
      where: { id: staffId, role: 'staff' },
    });
    if (!staff) throw ApiError.notFound();

    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: staffId },
        data: { isActive: false, deactivatedReason: 'Deactivated by admin' },
      }),
      prisma.userDevice.updateMany({
        where: { userId: staffId },
        data: { blocked: true },
      }),
    ]);

    return { deactivated: true };
  }

  static async changePassword(opts: {
    userId: string;
    oldPassword: string;
    newPassword: string;
  }) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: opts.userId },
      include: { authUser: true },
    });
    if (!profile) throw ApiError.notFound();

    const ok = await PasswordService.verify(opts.oldPassword, profile.authUser.passwordHash);
    if (!ok) throw ApiError.badRequest('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect');

    if (!PasswordService.isStrong(opts.newPassword)) {
      throw ApiError.badRequest('AUTH_WEAK_PASSWORD', 'New password is too weak');
    }

    const newHash = await PasswordService.hash(opts.newPassword);

    await prisma.$transaction([
      prisma.authUser.update({
        where: { id: profile.authUserId },
        data: { passwordHash: newHash },
      }),
      prisma.userProfile.update({
        where: { id: opts.userId },
        data: { mustChangePassword: false },
      }),
    ]);

    return { changed: true };
  }
}
