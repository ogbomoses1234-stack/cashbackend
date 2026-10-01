import { prisma } from '../config/database';
import { slugify } from '../utils/slugify';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';
import { CategoryService } from './category.service';

type SortKey = 'newest' | 'price_asc' | 'price_desc';

export class ProductService {
  static async listPublic(opts: {
    search?: string;
    category?: string;
    featured?: boolean;
    sort?: SortKey;
    page?: number;
    perPage?: number;
  }) {
    const { skip, take, page, perPage } = getPagination(
      { page: opts.page, perPage: opts.perPage },
      { page: 1, perPage: 24 }
    );

    // Resolve slug → real category name if needed
    let categoryName = opts.category;
    if (categoryName) {
      const resolved = await CategoryService.resolveSlug(categoryName);
      categoryName = resolved ?? categoryName;
    }

    const where: any = { isActive: true };
    if (opts.search) {
      where.OR = [
        { title: { contains: opts.search, mode: 'insensitive' } },
        { description: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (categoryName) {
      where.category = { equals: categoryName, mode: 'insensitive' };
    }
    if (opts.featured) where.isFeatured = true;

    const orderBy: any =
      opts.sort === 'price_asc'
        ? { price: 'asc' }
        : opts.sort === 'price_desc'
        ? { price: 'desc' }
        : { createdAt: 'desc' };

    const [items, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy, skip, take }),
      prisma.product.count({ where }),
    ]);

    return { items, meta: { page, perPage, total } };
  }

  static async getBySlug(slug: string) {
    const product = await prisma.product.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    });
    if (!product || !product.isActive) {
      throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    }
    return product;
  }

  static async getById(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    return product;
  }

  static async create(opts: {
    title: string;
    description?: string;
    price: number;
    thumbnailUrl?: string;
    category?: string;
    stockCount?: number;
    isFeatured?: boolean;
  }) {
    const slug = slugify(opts.title);
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (exists) {
      throw ApiError.conflict('PRODUCT_SLUG_TAKEN', 'A product with this title already exists');
    }

    return prisma.product.create({
      data: {
        title: opts.title,
        slug,
        description: opts.description,
        price: opts.price,
        thumbnailUrl: opts.thumbnailUrl,
        category: opts.category,
        stockCount: opts.stockCount ?? 0,
        isFeatured: opts.isFeatured ?? false,
      },
    });
  }

  static async update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      price: number;
      thumbnailUrl: string;
      category: string;
      stockCount: number;
      isActive: boolean;
      isFeatured: boolean;
    }>
  ) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

    const update: any = { ...data };
    if (data.title) update.slug = slugify(data.title);

    return prisma.product.update({ where: { id }, data: update });
  }

  static async toggleFeatured(id: string, isFeatured: boolean) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');
    return prisma.product.update({
      where: { id },
      data: { isFeatured },
    });
  }

  static async delete(id: string) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

    const serialCount = await prisma.productSerial.count({
      where: { productId: id },
    });
    if (serialCount > 0) {
      throw ApiError.conflict(
        'PRODUCT_HAS_SERIALS',
        `Cannot delete: ${serialCount} serials are attached to this product`
      );
    }

    await prisma.product.delete({ where: { id } });
    return { deleted: true };
  }

  static async listAdmin(opts: {
    search?: string;
    page?: number;
    perPage?: number;
  } = {}) {
    const { skip, take, page, perPage } = getPagination(
      { page: opts.page, perPage: opts.perPage },
      { page: 1, perPage: 50 }
    );
    const where: any = {};
    if (opts.search) {
      where.OR = [
        { title: { contains: opts.search, mode: 'insensitive' } },
        { slug: { contains: opts.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { serials: true } } },
        skip,
        take,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, meta: { page, perPage, total } };
  }
}
