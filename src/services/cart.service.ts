import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';

export class CartService {
  static async list(userId: string) {
    return prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  static async add(userId: string, productId: string, quantity: number) {
    if (quantity < 1) throw ApiError.badRequest('CART_INVALID_QTY', 'Quantity must be at least 1');

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

    return prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  static async updateQuantity(userId: string, cartItemId: string, quantity: number) {
    if (quantity < 1) throw ApiError.badRequest('CART_INVALID_QTY', 'Quantity must be at least 1');

    const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
    if (!item || item.userId !== userId) throw ApiError.notFound();

    return prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  static async remove(userId: string, cartItemId: string) {
    const item = await prisma.cartItem.findUnique({ where: { id: cartItemId } });
    if (!item || item.userId !== userId) throw ApiError.notFound();

    await prisma.cartItem.delete({ where: { id: cartItemId } });
    return { deleted: true };
  }

  static async clear(userId: string) {
    await prisma.cartItem.deleteMany({ where: { userId } });
    return { cleared: true };
  }
}
