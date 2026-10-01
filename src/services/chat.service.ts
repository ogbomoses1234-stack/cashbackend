import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';
import type { Role } from '../types';

export class ChatService {
  static async listForCustomer(customerId: string) {
    return prisma.chatThread.findMany({
      where: { customerId },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  static async listAll(opts: { status?: string; page?: number; perPage?: number } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });
    const where: any = {};
    if (opts.status) where.status = opts.status;

    const [items, total] = await Promise.all([
      prisma.chatThread.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, email: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        skip,
        take,
      }),
      prisma.chatThread.count({ where }),
    ]);

    return { items, meta: { page, perPage, total } };
  }

  static async createThread(opts: {
    customerId: string;
    subject: string;
    body: string;
    attachmentKey?: string;
  }) {
    const thread = await prisma.chatThread.create({
      data: {
        customerId: opts.customerId,
        subject: opts.subject.slice(0, 200),
        status: 'awaiting_admin',
      },
    });

    await prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        senderId: opts.customerId,
        senderRole: 'customer',
        body: opts.body,
        attachmentKey: opts.attachmentKey,
      },
    });

    return thread;
  }

  static async listMessages(
    threadId: string,
    viewer: { id: string; role: Role }
  ) {
    const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) throw ApiError.notFound('THREAD_NOT_FOUND', 'Thread not found');

    if (viewer.role === 'customer' && thread.customerId !== viewer.id) {
      throw ApiError.forbidden();
    }

    return prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Core rule: a customer may only send ONE message until admin replies.
   * Enforced by the thread status state machine.
   */
  static async sendMessage(opts: {
    threadId: string;
    senderId: string;
    senderRole: Role;
    body: string;
    attachmentKey?: string;
  }) {
    const { threadId, senderId, senderRole } = opts;

    const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) throw ApiError.notFound('THREAD_NOT_FOUND', 'Thread not found');

    if (senderRole === 'customer') {
      if (thread.customerId !== senderId) throw ApiError.forbidden();
      if (thread.status === 'awaiting_admin') {
        throw ApiError.conflict(
          'CHAT_AWAITING_ADMIN',
          'Please wait for admin reply before sending another message.'
        );
      }
      if (thread.status === 'closed') {
        throw ApiError.conflict('CHAT_CLOSED', 'This conversation is closed.');
      }
    }

    const message = await prisma.chatMessage.create({
      data: {
        threadId,
        senderId,
        senderRole,
        body: opts.body,
        attachmentKey: opts.attachmentKey,
      },
    });

    const newStatus = senderRole === 'admin' ? 'awaiting_customer' : 'awaiting_admin';
    await prisma.chatThread.update({
      where: { id: threadId },
      data: { status: newStatus as any, lastMessageAt: new Date() },
    });

    return message;
  }

  static async closeThread(threadId: string) {
    const thread = await prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) throw ApiError.notFound();

    return prisma.chatThread.update({
      where: { id: threadId },
      data: { status: 'closed' },
    });
  }
}
