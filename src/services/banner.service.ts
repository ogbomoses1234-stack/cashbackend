import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

interface BannerInput {
  imageUrl: string;
  headline: string;
  subtext?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export class BannerService {
  /** Public — active banners ordered for the carousel */
  static async listActive() {
    return prisma.banner.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        imageUrl: true,
        headline: true,
        subtext: true,
        ctaText: true,
        ctaUrl: true,
      },
    });
  }

  /** Admin — all banners */
  static async listAll() {
    return prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  static async create(input: BannerInput) {
    if (!input.imageUrl || !input.headline) {
      throw ApiError.badRequest(
        'BANNER_VALIDATION',
        'imageUrl and headline are required'
      );
    }
    return prisma.banner.create({
      data: {
        imageUrl: input.imageUrl,
        headline: input.headline,
        subtext: input.subtext ?? null,
        ctaText: input.ctaText ?? null,
        ctaUrl: input.ctaUrl ?? null,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 0,
        isActive: input.isActive !== false,
      },
    });
  }

  static async update(id: string, input: Partial<BannerInput>) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('BANNER_NOT_FOUND', 'Banner not found');

    return prisma.banner.update({
      where: { id },
      data: {
        imageUrl: input.imageUrl ?? existing.imageUrl,
        headline: input.headline ?? existing.headline,
        subtext: input.subtext === undefined ? existing.subtext : input.subtext,
        ctaText: input.ctaText === undefined ? existing.ctaText : input.ctaText,
        ctaUrl: input.ctaUrl === undefined ? existing.ctaUrl : input.ctaUrl,
        sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : existing.sortOrder,
        isActive: input.isActive === undefined ? existing.isActive : input.isActive,
      },
    });
  }

  static async delete(id: string) {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('BANNER_NOT_FOUND', 'Banner not found');
    await prisma.banner.delete({ where: { id } });
    return { deleted: true };
  }
}
