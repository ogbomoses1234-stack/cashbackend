import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export class WalletService {
  static async getSummary(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { walletBalance: true, pendingBalance: true, totalEarned: true },
    });
    if (!profile) throw ApiError.notFound();

    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return { ...profile, transactions };
  }

  static async listTransactions(userId: string, limit = 50) {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
