import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';
import { StorageService } from './storage.service';
import { PasswordService } from './password.service';

export class UserService {
  static async list(opts: {
    role?: string;
    status?: string;
    search?: string;
    page?: number;
    perPage?: number;
  } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });
    const where: any = {};
    if (opts.role) where.role = opts.role;
    if (opts.status === 'active') where.isActive = true;
    if (opts.status === 'deactivated') where.isActive = false;
    if (opts.search) {
      where.OR = [
        { fullName: { contains: opts.search, mode: 'insensitive' } },
        { email: { contains: opts.search, mode: 'insensitive' } },
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
          role: true,
          walletBalance: true,
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

  static async get(userId: string) {
    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: {
        devices: { orderBy: { lastSeenAt: 'desc' }, take: 10 },
        _count: { select: { orders: true, transactions: true, disputes: true } },
      },
    });
    if (!user) throw ApiError.notFound();
    return user;
  }

  static async deactivate(userId: string, reason: string) {
    const user = await prisma.userProfile.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound();
    if (user.role === 'admin') {
      throw ApiError.forbidden('ADMIN_PROTECTED', 'Cannot deactivate admins');
    }
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: userId },
        data: { isActive: false, deactivatedReason: reason },
      }),
      prisma.userDevice.updateMany({
        where: { userId },
        data: { blocked: true },
      }),
    ]);
    return { deactivated: true };
  }

  static async reactivate(userId: string) {
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { id: userId },
        data: { isActive: true, deactivatedReason: null },
      }),
      prisma.userDevice.updateMany({
        where: { userId },
        data: { blocked: false },
      }),
    ]);
    return { reactivated: true };
  }

  static async resetPassword(userId: string) {
    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: { authUser: true },
    });
    if (!user) throw ApiError.notFound();

    const tempPassword = PasswordService.generateTempPassword();
    const hash = await PasswordService.hash(tempPassword);

    await prisma.$transaction([
      prisma.authUser.update({
        where: { id: user.authUserId },
        data: { passwordHash: hash, failedAttempts: 0, lockedUntil: null },
      }),
      prisma.userProfile.update({
        where: { id: userId },
        data: { mustChangePassword: true },
      }),
    ]);

    return { tempPassword };
  }

  static async purge(userId: string) {
    const user = await prisma.userProfile.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound();

    await StorageService.deletePrefix('private', 'receipts/' + userId + '/').catch(() => {});
    await StorageService.deletePrefix('private', 'disputes/' + userId + '/').catch(() => {});
    await StorageService.deletePrefix('public', 'avatars/' + userId + '/').catch(() => {});

    await prisma.authUser.delete({ where: { id: user.authUserId } });
    return { purged: true };
  }
}
