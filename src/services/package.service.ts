import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { getPagination } from '../utils/pagination';
import { generatePackageRef } from '../utils/generateSerial';
import { StorageService } from './storage.service';
import { EmailService } from './email.service';

type Status =
  | 'draft' | 'submitted' | 'quoted' | 'approved'
  | 'in_progress' | 'shipped' | 'delivered' | 'cancelled';

const CLOSED: Status[] = ['delivered', 'cancelled'];
const isClosed = (s: string): boolean => (CLOSED as string[]).includes(s);

async function signItemImage(objectKey: string | null): Promise<string | null> {
  if (!objectKey) return null;
  try {
    return await StorageService.getDownloadUrl({
      bucket: 'private',
      objectKey,
      expiresIn: 300,
    });
  } catch {
    return null;
  }
}

async function serializePackage(row: any, opts: { signImages?: boolean } = {}) {
  const pendingEdit =
    (row.editRequests ?? []).find((e: any) => e.status === 'pending') ?? null;

  const items = await Promise.all(
    (row.items ?? []).map(async (it: any) => ({
      id: it.id,
      requestId: it.requestId,
      productId: it.productId ?? null,
      name: it.name,
      details: it.details ?? null,
      quantity: it.quantity,
      estimatedPrice: it.estimatedPrice ? it.estimatedPrice.toString() : null,
      imageObjectKey: it.imageObjectKey ?? null,
      imageUrl:
        opts.signImages && it.imageObjectKey
          ? await signItemImage(it.imageObjectKey)
          : null,
      createdAt: it.createdAt.toISOString(),
    }))
  );

  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    status: row.status,
    isEditable: row.isEditable,
    notes: row.notes ?? null,
    country: row.country,
    city: row.city,
    deliveryAddress: row.deliveryAddress,
    contactPhone: row.contactPhone,
    quotedTotal: row.quotedTotal ? row.quotedTotal.toString() : null,
    currency: row.currency,
    items,
    pendingEditRequest: pendingEdit
      ? {
          id: pendingEdit.id,
          requestId: pendingEdit.requestId,
          reason: pendingEdit.reason,
          status: pendingEdit.status,
          adminNote: pendingEdit.adminNote ?? null,
          createdAt: pendingEdit.createdAt.toISOString(),
          resolvedAt: pendingEdit.resolvedAt?.toISOString() ?? null,
        }
      : null,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeMessage(m: any) {
  return {
    id: m.id,
    requestId: m.requestId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    body: m.body,
    attachmentObjectKey: m.attachmentObjectKey ?? null,
    attachmentUrl: null,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

export class PackageService {
  private static async assertOwnership(userId: string, id: string) {
    const row = await prisma.packageRequest.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('PACKAGE_NOT_FOUND', 'List not found');
    if (row.userId !== userId) throw ApiError.forbidden();
    return row;
  }

  private static async assertEditable(userId: string, id: string) {
    const row = await this.assertOwnership(userId, id);
    if (isClosed(row.status)) {
      throw ApiError.conflict('PACKAGE_CLOSED', 'This list is closed');
    }
    if (!row.isEditable) {
      throw ApiError.conflict(
        'PACKAGE_LOCKED',
        'This list is locked. Request an edit to make changes.'
      );
    }
    return row;
  }

  /* ─── CUSTOMER ──────────────────────────────────────── */

  static async listMine(userId: string) {
    const rows = await prisma.packageRequest.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        editRequests: {
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    return Promise.all(rows.map((r) => serializePackage(r, { signImages: false })));
  }

  static async getMine(userId: string, id: string) {
    const row = await prisma.packageRequest.findFirst({
      where: { id, userId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        editRequests: {
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!row) throw ApiError.notFound('PACKAGE_NOT_FOUND', 'List not found');
    return serializePackage(row, { signImages: true });
  }

  static async create(
    userId: string,
    input: {
      title: string;
      notes?: string;
      country: string;
      city: string;
      deliveryAddress: string;
      contactPhone: string;
    }
  ) {
    const created = await prisma.packageRequest.create({
      data: {
        reference: generatePackageRef(),
        userId,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        country: input.country.trim(),
        city: input.city.trim(),
        deliveryAddress: input.deliveryAddress.trim(),
        contactPhone: input.contactPhone.trim(),
        status: 'draft',
        isEditable: true,
      },
      include: { items: true, editRequests: true },
    });
    return serializePackage(created, { signImages: false });
  }

  static async update(
    userId: string,
    id: string,
    input: Partial<{
      title: string;
      notes: string | null;
      country: string;
      city: string;
      deliveryAddress: string;
      contactPhone: string;
    }>
  ) {
    await this.assertEditable(userId, id);
    const data: any = {};
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null;
    if (input.country !== undefined) data.country = input.country.trim();
    if (input.city !== undefined) data.city = input.city.trim();
    if (input.deliveryAddress !== undefined)
      data.deliveryAddress = input.deliveryAddress.trim();
    if (input.contactPhone !== undefined) data.contactPhone = input.contactPhone.trim();

    const updated = await prisma.packageRequest.update({
      where: { id },
      data,
      include: { items: true, editRequests: true },
    });
    return serializePackage(updated, { signImages: false });
  }

  static async delete(userId: string, id: string) {
    const row = await this.assertOwnership(userId, id);
    if (row.status !== 'draft') {
      throw ApiError.conflict('PACKAGE_NOT_DRAFT', 'Only draft lists can be deleted');
    }
    await prisma.packageRequest.delete({ where: { id } });
  }

  static async submit(userId: string, id: string) {
    const row = await this.assertEditable(userId, id);

    const itemCount = await prisma.packageItem.count({ where: { requestId: id } });
    if (itemCount === 0) {
      throw ApiError.badRequest('PACKAGE_EMPTY', 'Add at least one item before submitting');
    }
    if (
      !row.title.trim() ||
      !row.country.trim() ||
      !row.city.trim() ||
      row.deliveryAddress.trim().length < 10 ||
      row.contactPhone.trim().length < 7
    ) {
      throw ApiError.badRequest('PACKAGE_INCOMPLETE', 'Complete all shipping fields');
    }

    const wasEditCycle = row.status !== 'draft';

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.packageRequest.update({
        where: { id },
        data: { isEditable: false, status: 'submitted' },
        include: { items: true, editRequests: true },
      });
      await tx.packageMessage.create({
        data: {
          requestId: id,
          senderId: 'system',
          senderRole: 'admin',
          body: wasEditCycle
            ? '📝 Customer re-submitted the list after an approved edit.'
            : '📨 New list submitted for review.',
        },
      });
      await tx.packageRequest.update({
        where: { id },
        data: { lastMessageAt: new Date() },
      });
      return u;
    });

    return serializePackage(updated, { signImages: false });
  }

  static async requestEdit(userId: string, id: string, reason: string) {
    const row = await this.assertOwnership(userId, id);
    if (isClosed(row.status)) throw ApiError.conflict('PACKAGE_CLOSED', 'This list is closed');
    if (row.isEditable) throw ApiError.conflict('PACKAGE_ALREADY_EDITABLE', 'Already editable');

    const pending = await prisma.packageEditRequest.findFirst({
      where: { requestId: id, status: 'pending' },
    });
    if (pending) throw ApiError.conflict('EDIT_ALREADY_PENDING', 'Pending edit already exists');

    const created = await prisma.packageEditRequest.create({
      data: { requestId: id, reason: reason.trim() },
    });

    await prisma.packageMessage.create({
      data: {
        requestId: id,
        senderId: 'system',
        senderRole: 'admin',
        body: `🔓 Customer requested an edit: "${reason.trim()}"`,
      },
    });

    await prisma.packageRequest.update({
      where: { id },
      data: { lastMessageAt: new Date() },
    });

    return {
      id: created.id,
      requestId: created.requestId,
      reason: created.reason,
      status: created.status,
      adminNote: created.adminNote,
      createdAt: created.createdAt.toISOString(),
      resolvedAt: created.resolvedAt?.toISOString() ?? null,
    };
  }

  /* ─── ITEMS ─────────────────────────────────────────── */

  static async addItem(
    userId: string,
    requestId: string,
    input: {
      name: string;
      details?: string;
      quantity: number;
      estimatedPrice?: string;
      imageObjectKey?: string;
    }
  ) {
    await this.assertEditable(userId, requestId);
    const item = await prisma.packageItem.create({
      data: {
        requestId,
        name: input.name.trim(),
        details: input.details?.trim() || null,
        quantity: input.quantity,
        estimatedPrice: input.estimatedPrice
          ? new Prisma.Decimal(input.estimatedPrice)
          : null,
        imageObjectKey: input.imageObjectKey ?? null,
      },
    });
    await prisma.packageRequest.update({
      where: { id: requestId },
      data: { updatedAt: new Date() },
    });
    return {
      id: item.id,
      requestId: item.requestId,
      productId: item.productId,
      name: item.name,
      details: item.details,
      quantity: item.quantity,
      estimatedPrice: item.estimatedPrice ? item.estimatedPrice.toString() : null,
      imageObjectKey: item.imageObjectKey,
      imageUrl: item.imageObjectKey ? await signItemImage(item.imageObjectKey) : null,
      createdAt: item.createdAt.toISOString(),
    };
  }

  static async updateItem(
    userId: string,
    requestId: string,
    itemId: string,
    input: Partial<{
      name: string;
      details: string | null;
      quantity: number;
      estimatedPrice: string | null;
      imageObjectKey: string | null;
    }>
  ) {
    await this.assertEditable(userId, requestId);
    const item = await prisma.packageItem.findUnique({ where: { id: itemId } });
    if (!item || item.requestId !== requestId) throw ApiError.notFound();

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.details !== undefined) data.details = input.details?.trim() || null;
    if (input.quantity !== undefined) data.quantity = input.quantity;
    if (input.estimatedPrice !== undefined) {
      data.estimatedPrice = input.estimatedPrice
        ? new Prisma.Decimal(input.estimatedPrice)
        : null;
    }
    if (input.imageObjectKey !== undefined) {
      data.imageObjectKey = input.imageObjectKey ?? null;
    }

    const updated = await prisma.packageItem.update({ where: { id: itemId }, data });
    await prisma.packageRequest.update({
      where: { id: requestId },
      data: { updatedAt: new Date() },
    });

    return {
      id: updated.id,
      requestId: updated.requestId,
      productId: updated.productId,
      name: updated.name,
      details: updated.details,
      quantity: updated.quantity,
      estimatedPrice: updated.estimatedPrice ? updated.estimatedPrice.toString() : null,
      imageObjectKey: updated.imageObjectKey,
      imageUrl: updated.imageObjectKey ? await signItemImage(updated.imageObjectKey) : null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  static async removeItem(userId: string, requestId: string, itemId: string) {
    await this.assertEditable(userId, requestId);
    const item = await prisma.packageItem.findUnique({ where: { id: itemId } });
    if (!item || item.requestId !== requestId) throw ApiError.notFound();
    await prisma.packageItem.delete({ where: { id: itemId } });
    await prisma.packageRequest.update({
      where: { id: requestId },
      data: { updatedAt: new Date() },
    });
  }

  /* ─── MESSAGES ──────────────────────────────────────── */

  static async listMessages(userId: string, requestId: string) {
    await this.assertOwnership(userId, requestId);
    const rows = await prisma.packageMessage.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serializeMessage);
  }

  static async sendMessage(
    userId: string,
    requestId: string,
    body: string,
    attachmentKey?: string
  ) {
    const row = await this.assertOwnership(userId, requestId);
    if (isClosed(row.status)) throw ApiError.conflict('PACKAGE_CLOSED', 'This list is closed');

    const msg = await prisma.packageMessage.create({
      data: {
        requestId,
        senderId: userId,
        senderRole: 'customer',
        body: body.trim(),
        attachmentObjectKey: attachmentKey ?? null,
      },
    });
    await prisma.packageRequest.update({
      where: { id: requestId },
      data: { lastMessageAt: new Date() },
    });
    return serializeMessage(msg);
  }

  /* ═══════════════════════════════════════════════════
     ADMIN
  ═══════════════════════════════════════════════════ */

  static async listAdmin(opts: {
    status?: string;
    search?: string;
    page?: number;
    perPage?: number;
  } = {}) {
    const { skip, take, page, perPage } = getPagination(opts, { page: 1, perPage: 30 });

    const where: any = {};
    if (opts.status && opts.status !== 'all') where.status = opts.status;
    if (opts.search) {
      where.OR = [
        { reference: { contains: opts.search, mode: 'insensitive' } },
        { title: { contains: opts.search, mode: 'insensitive' } },
        { user: { fullName: { contains: opts.search, mode: 'insensitive' } } },
        { user: { email: { contains: opts.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.packageRequest.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
          items: { orderBy: { createdAt: 'asc' } },
          editRequests: {
            where: { status: 'pending' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { messages: true } },
        },
        skip,
        take,
      }),
      prisma.packageRequest.count({ where }),
    ]);

    const serialized = await Promise.all(
      items.map(async (r) => ({
        ...(await serializePackage(r, { signImages: false })),
        customer: r.user,
        messageCount: (r as any)._count?.messages ?? 0,
      }))
    );

    return { items: serialized, meta: { page, perPage, total } };
  }

  static async getAdmin(id: string) {
    const row = await prisma.packageRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        items: { orderBy: { createdAt: 'asc' } },
        messages: { orderBy: { createdAt: 'asc' } },
        editRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!row) throw ApiError.notFound('PACKAGE_NOT_FOUND', 'List not found');

    return {
      ...(await serializePackage(row, { signImages: true })),
      customer: row.user,
      messages: row.messages.map(serializeMessage),
      allEditRequests: row.editRequests.map((e) => ({
        id: e.id,
        requestId: e.requestId,
        reason: e.reason,
        status: e.status,
        adminNote: e.adminNote,
        createdAt: e.createdAt.toISOString(),
        resolvedAt: e.resolvedAt?.toISOString() ?? null,
      })),
    };
  }

  static async replyAsAdmin(
    adminId: string,
    requestId: string,
    body: string,
    attachmentKey?: string
  ) {
    const row = await prisma.packageRequest.findUnique({ where: { id: requestId } });
    if (!row) throw ApiError.notFound();

    const msg = await prisma.packageMessage.create({
      data: {
        requestId,
        senderId: adminId,
        senderRole: 'admin',
        body: body.trim(),
        attachmentObjectKey: attachmentKey ?? null,
      },
    });
    await prisma.packageRequest.update({
      where: { id: requestId },
      data: { lastMessageAt: new Date() },
    });
    return serializeMessage(msg);
  }

  static async setStatus(
    adminId: string,
    id: string,
    status: Status,
    reason?: string
  ) {
    const row = await prisma.packageRequest.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound();
    if (isClosed(row.status)) throw ApiError.conflict('PACKAGE_CLOSED', 'Already closed');
    if (status === 'cancelled' && !reason) {
      throw ApiError.badRequest('PACKAGE_CANCEL_REASON', 'Provide a reason to cancel');
    }

    const updated = await prisma.packageRequest.update({
      where: { id },
      data: { status },
      include: { items: true, editRequests: true },
    });

    if (status === 'cancelled') {
      await prisma.packageMessage.create({
        data: {
          requestId: id,
          senderId: adminId,
          senderRole: 'admin',
          body: `❌ List cancelled: ${reason}`,
        },
      });
    } else {
      await prisma.packageMessage.create({
        data: {
          requestId: id,
          senderId: 'system',
          senderRole: 'admin',
          body: `ℹ️ Status updated to "${status.replace('_', ' ')}".`,
        },
      });
    }

    prisma.userProfile
      .findUnique({ where: { id: updated.userId }, select: { email: true } })
      .then((u) => {
        if (u?.email) {
          EmailService.sendPackageStatus(u.email, updated.reference, status).catch(() => {});
        }
      })
      .catch(() => {});

    return serializePackage(updated, { signImages: false });
  }

  static async setQuote(id: string, quotedTotal: string, currency = 'NGN') {
    const row = await prisma.packageRequest.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound();
    if (isClosed(row.status)) throw ApiError.conflict('PACKAGE_CLOSED', 'List closed');

    const updated = await prisma.packageRequest.update({
      where: { id },
      data: {
        quotedTotal: new Prisma.Decimal(quotedTotal),
        currency,
        status: row.status === 'submitted' ? 'quoted' : row.status,
      },
      include: { items: true, editRequests: true },
    });

    await prisma.packageMessage.create({
      data: {
        requestId: id,
        senderId: 'system',
        senderRole: 'admin',
        body: `💰 Admin set a quote: ${currency} ${quotedTotal}. Reply here to confirm.`,
      },
    });

    return serializePackage(updated, { signImages: false });
  }

  static async resolveEditRequest(
    adminId: string,
    requestId: string,
    editId: string,
    decision: 'approved' | 'denied',
    adminNote?: string
  ) {
    const edit = await prisma.packageEditRequest.findUnique({ where: { id: editId } });
    if (!edit || edit.requestId !== requestId) throw ApiError.notFound();
    if (edit.status !== 'pending') throw ApiError.conflict('EDIT_RESOLVED', 'Already resolved');

    const request = await prisma.packageRequest.findUnique({ where: { id: requestId } });
    if (!request) throw ApiError.notFound();
    if (isClosed(request.status)) throw ApiError.conflict('PACKAGE_CLOSED', 'List closed');

    const updatedEdit = await prisma.$transaction(async (tx) => {
      const e = await tx.packageEditRequest.update({
        where: { id: editId },
        data: {
          status: decision,
          adminNote: adminNote ?? null,
          resolvedAt: new Date(),
        },
      });
      if (decision === 'approved') {
        await tx.packageRequest.update({
          where: { id: requestId },
          data: { isEditable: true },
        });
      }
      await tx.packageMessage.create({
        data: {
          requestId,
          senderId: adminId,
          senderRole: 'admin',
          body:
            decision === 'approved'
              ? `✅ Edit request approved. You can now update the list.${adminNote ? ` — ${adminNote}` : ''}`
              : `🚫 Edit request denied.${adminNote ? ` — ${adminNote}` : ''}`,
        },
      });
      await tx.packageRequest.update({
        where: { id: requestId },
        data: { lastMessageAt: new Date() },
      });
      return e;
    });

    prisma.userProfile
      .findUnique({ where: { id: request.userId }, select: { email: true } })
      .then((u) => {
        if (u?.email) {
          EmailService.sendPackageEditDecision(u.email, request.reference, decision).catch(() => {});
        }
      })
      .catch(() => {});

    return {
      id: updatedEdit.id,
      requestId: updatedEdit.requestId,
      reason: updatedEdit.reason,
      status: updatedEdit.status,
      adminNote: updatedEdit.adminNote,
      createdAt: updatedEdit.createdAt.toISOString(),
      resolvedAt: updatedEdit.resolvedAt?.toISOString() ?? null,
    };
  }
}
