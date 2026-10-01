import { prisma } from '../config/database';

export function slugifyCategory(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class CategoryService {
  /** Public — grouped by products.category, with representative image */
  static async list() {
    const rows = await prisma.product.groupBy({
      by: ['category'],
      where: { isActive: true, category: { not: null } },
      _count: { _all: true },
    });

    const base = rows
      .filter((r) => r.category && r.category.trim() !== '')
      .map((r) => ({
        name: r.category!,
        slug: slugifyCategory(r.category!),
        count: r._count._all,
        imageUrl: null as string | null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Fetch one sample thumbnail per category in parallel
    await Promise.all(
      base.map(async (cat) => {
        const sample = await prisma.product.findFirst({
          where: {
            category: cat.name,
            isActive: true,
            thumbnailUrl: { not: null },
          },
          select: { thumbnailUrl: true },
        });
        cat.imageUrl = sample?.thumbnailUrl ?? null;
      })
    );

    return base;
  }

  /** Resolve a category slug ("body-lotion") to the real category name */
  static async resolveSlug(slug: string): Promise<string | null> {
    const all = await prisma.product.findMany({
      where: { isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });
    const match = all.find(
      (p) => p.category && slugifyCategory(p.category) === slug
    );
    return match?.category ?? null;
  }
}
