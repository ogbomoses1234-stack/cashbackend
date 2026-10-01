import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';

export class DisputeService {
  static async create(opts: {
    userId: string;
    serialNumber: string;
    description: string;
    photoObjectKey?: string;
  }) {
    return prisma.disputeReport.create({
      data: {
        userId: opts.userId,
        serialNumber: opts.serialNumber,
        description: opts.description,
        photoObjectKey: opts.photoObjectKey,
      },
    });
  }

  static async listMine(userId: string) {
    return prisma.disputeReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async listAdmin(opts: { status?: string; page?: number; perPage?: number } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });
    const where: any = {};
    if (opts.status) where.status = opts.status;

    const [items, total] = await Promise.all([
      prisma.disputeReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
        skip,
        take,
      }),
      prisma.disputeReport.count({ where }),
    ]);

    return { items, meta: { page, perPage, total } };
  }

  static async updateStatus(
    disputeId: string,
    status: 'open' | 'investigating' | 'resolved' | 'rejected',
    adminNote?: string
  ) {
    const dispute = await prisma.disputeReport.findUnique({ where: { id: disputeId } });
    if (!dispute) throw ApiError.notFound();

    return prisma.disputeReport.update({
      where: { id: disputeId },
      data: { status, adminNote },
    });
  }
}
