import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { generateOrderNumber } from '../utils/generateSerial';
import { getPagination } from '../utils/pagination';
import { EmailService } from './email.service';

interface CreateOrderInput {
  userId: string;
  items: { productId: string; quantity: number }[];
  paymentMethod: 'bank_transfer' | 'pod';
  deliveryAddress: string;
  receiptObjectKey?: string;
}

export class OrderService {
  static async create(opts: CreateOrderInput) {
    if (!opts.items?.length) throw ApiError.badRequest('ORDER_EMPTY', 'No items in order');

    if (opts.paymentMethod === 'bank_transfer' && !opts.receiptObjectKey) {
      throw ApiError.badRequest('ORDER_RECEIPT_REQUIRED', 'Upload your transfer receipt');
    }

    const productIds = opts.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      throw ApiError.badRequest('ORDER_INVALID_ITEM', 'Unknown product in order');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let total = new Prisma.Decimal(0);
    for (const item of opts.items) {
      if (item.quantity < 1) throw ApiError.badRequest('ORDER_INVALID_QTY', 'Invalid quantity');
      const p = productMap.get(item.productId)!;
      total = total.add(p.price.mul(item.quantity));
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: opts.userId,
          totalAmount: total,
          paymentMethod: opts.paymentMethod,
          deliveryAddress: opts.deliveryAddress,
          receiptObjectKey: opts.receiptObjectKey,
          status: 'Processing',
          items: {
            create: opts.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: productMap.get(item.productId)!.price,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });

      // Clear user's cart for ordered products
      await tx.cartItem.deleteMany({
        where: { userId: opts.userId, productId: { in: productIds } },
      });

      return created;
    });

    // Fire-and-forget email
    prisma.userProfile
      .findUnique({ where: { id: opts.userId }, select: { email: true } })
      .then((u) => {
        if (u?.email) {
          EmailService.sendOrderStatus(u.email, order.orderNumber, 'Processing').catch(() => {});
        }
      })
      .catch(() => {});

    return order;
  }

  static async listMine(userId: string, opts: { page?: number; perPage?: number } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 20 });

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: true } } },
        skip,
        take,
      }),
      prisma.order.count({ where: { userId } }),
    ]);

    return { items, meta: { page, perPage, total } };
  }

  static async getMine(userId: string, orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order || order.userId !== userId) throw ApiError.notFound();
    return order;
  }

  static async listAdmin(opts: {
    status?: string;
    page?: number;
    perPage?: number;
  } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });

    const where: any = {};
    if (opts.status) where.status = opts.status;

    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
          items: { include: { product: true } },
        },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    return { items, meta: { page, perPage, total } };
  }

  static async getAdmin(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            deliveryAddress: true,
          },
        },
        items: { include: { product: true } },
      },
    });
    if (!order) throw ApiError.notFound();
    return order;
  }

  static async approve(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound();
    if (order.status !== 'Processing') {
      throw ApiError.conflict('ORDER_NOT_PROCESSING', 'Order is not in Processing state');
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'Shipped' },
    });

    prisma.userProfile
      .findUnique({ where: { id: order.userId }, select: { email: true } })
      .then((u) => {
        if (u?.email) EmailService.sendOrderStatus(u.email, order.orderNumber, 'Shipped').catch(() => {});
      })
      .catch(() => {});

    return updated;
  }

  static async flag(orderId: string, reason: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound();

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'Flagged', flagReason: reason, flaggedAt: new Date() },
    });

    prisma.userProfile
      .findUnique({ where: { id: order.userId }, select: { email: true } })
      .then((u) => {
        if (u?.email) EmailService.sendOrderStatus(u.email, order.orderNumber, 'Flagged').catch(() => {});
      })
      .catch(() => {});

    return updated;
  }

  /** Sign a presigned GET URL for the order's receipt (admin review). */
  static async getReceiptUrl(orderId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw ApiError.notFound('ORDER_NOT_FOUND', 'Order not found');
    if (!order.receiptObjectKey) {
      throw ApiError.notFound('NO_RECEIPT', 'No receipt attached to this order');
    }

    const { StorageService } = await import('./storage.service');
    const url = await StorageService.getDownloadUrl({
      bucket: 'private',
      objectKey: order.receiptObjectKey,
      expiresIn: 3600,
    });
    return { url, objectKey: order.receiptObjectKey };
  }
}
