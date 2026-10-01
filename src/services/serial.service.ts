import archiver from 'archiver';
import { PassThrough } from 'stream';
import { prisma } from '../config/database';
import { ApiError } from '../utils/ApiError';
import { QrService } from './qr.service';
import { StorageService } from './storage.service';
import { generateBatchId } from '../utils/generateSerial';

export class SerialService {
  /**
   * Generate N signed serials for a product, render QR PNGs, bundle into
   * a ZIP, upload the ZIP to MinIO, and return the batch info.
   */
  static async generateBatch(opts: { productId: string; volume: number }) {
    const { productId, volume } = opts;

    if (volume < 1 || volume > 10000) {
      throw ApiError.badRequest('SERIAL_INVALID_VOLUME', 'Volume must be between 1 and 10,000');
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw ApiError.notFound('PRODUCT_NOT_FOUND', 'Product not found');

    const batchId = generateBatchId();

    // 1. Build all serials + PNG buffers in memory
    const generated: {
      serialNumber: string;
      qrSignature: string;
      qrUrl: string;
      png: Buffer;
    }[] = [];

    for (let i = 0; i < volume; i++) {
      const row = await QrService.generateSerialWithPng();
      generated.push(row);
    }

    // 2. Insert into DB
    await prisma.productSerial.createMany({
      data: generated.map((g) => ({
        serialNumber: g.serialNumber,
        productId,
        qrSignature: g.qrSignature,
        batchId,
        status: 'Created',
      })),
      skipDuplicates: true,
    });

    // 3. Build ZIP in memory
    const zipBuffer = await this.buildZip(generated);

    // 4. Upload ZIP to MinIO private bucket
    const objectKey = `qr-archives/${batchId}/batch.zip`;
    await StorageService.putBuffer({
      bucket: 'private',
      objectKey,
      buffer: zipBuffer,
      contentType: 'application/zip',
    });

    return {
      batchId,
      count: generated.length,
      objectKey,
      product: { id: product.id, title: product.title },
    };
  }

  private static buildZip(
    rows: { serialNumber: string; png: Buffer; qrUrl: string }[]
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const pass = new PassThrough();
      const chunks: Buffer[] = [];

      pass.on('data', (c) => chunks.push(c));
      pass.on('end', () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
      archive.on('error', reject);
      archive.pipe(pass);

      for (const row of rows) {
        archive.append(row.png, { name: `${row.serialNumber}.png` });
      }

      const manifest = rows.map((r) => ({
        serialNumber: r.serialNumber,
        url: r.qrUrl,
      }));
      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      archive.finalize().catch(reject);
    });
  }

  static async getBatchArchiveUrl(batchId: string) {
    const objectKey = `qr-archives/${batchId}/batch.zip`;
    return StorageService.getDownloadUrl({ bucket: 'private', objectKey, expiresIn: 900 });
  }

  static async listByBatch(batchId: string) {
    return prisma.productSerial.findMany({
      where: { batchId },
      select: {
        serialNumber: true,
        qrSignature: true,
        status: true,
        batchId: true,
        productId: true,
        dispatchedBy: true,
        dispatchedAt: true,
        redeemedBy: true,
        redeemedAt: true,
        createdAt: true,
        product: { select: { id: true, title: true } },
        dispatcher: { select: { id: true, fullName: true, staffCode: true } },
        redeemer: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /* ═══════════════════════════════════════════
     TRACKER — full audit trail with relations
  ═══════════════════════════════════════════ */
  static async listTracker(opts: {
    status?: string;
    search?: string;
    dispatchedBy?: string;
    redeemedBy?: string;
    page?: number;
    perPage?: number;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.min(500, opts.perPage ?? 100);
    const skip = (page - 1) * perPage;

    const where: any = {};
    if (opts.status && opts.status !== 'all') where.status = opts.status;
    if (opts.dispatchedBy) where.dispatchedBy = opts.dispatchedBy;
    if (opts.redeemedBy) where.redeemedBy = opts.redeemedBy;

    if (opts.search) {
      where.OR = [
        { serialNumber: { contains: opts.search, mode: 'insensitive' } },
        { product: { title: { contains: opts.search, mode: 'insensitive' } } },
        {
          redeemer: {
            OR: [
              { fullName: { contains: opts.search, mode: 'insensitive' } },
              { email: { contains: opts.search, mode: 'insensitive' } },
            ],
          },
        },
        {
          dispatcher: {
            OR: [
              { fullName: { contains: opts.search, mode: 'insensitive' } },
              { staffCode: { contains: opts.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.productSerial.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, title: true } },
          dispatcher: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              staffCode: true,
              role: true,
            },
          },
          redeemer: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      }),
      prisma.productSerial.count({ where }),
    ]);

    return {
      items: items.map((s) => this.mapTracker(s)),
      meta: { page, perPage, total },
    };
  }

  static async getTrackerDetail(serialNumber: string) {
    const serial = await prisma.productSerial.findUnique({
      where: { serialNumber },
      include: {
        product: { select: { id: true, title: true } },
        dispatcher: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            staffCode: true,
            role: true,
          },
        },
        redeemer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
          },
        },
        scanEvents: {
          orderBy: { scannedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!serial) {
      throw ApiError.notFound('SERIAL_NOT_FOUND', 'Serial not found');
    }

    const scanLogs = (serial as any).scanEvents?.map((e: any) => ({
      id: e.id,
      scanType: e.scanType,
      success: e.success,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      scannedAt: e.scannedAt?.toISOString?.() ?? e.scannedAt,
      scannedBy: null as any,
    })) ?? [];

    /* Resolve scannedBy from userId manually */
    const userIds = new Set<string>();
    for (const log of scanLogs) {
      // userId was stripped above; keep it in the map key instead
    }
    // Simpler: re-fetch with user info
    const raw = (serial as any).scanEvents ?? [];
    const userIdSet = new Set(raw.map((e: any) => e.userId).filter(Boolean));
    const users = userIdSet.size
      ? await prisma.userProfile.findMany({
          where: { id: { in: Array.from(userIdSet) as string[] } },
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
            role: true,
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const scanLogsWithUsers = raw.map((e: any) => ({
      id: e.id,
      scanType: e.scanType,
      success: e.success,
      errorCode: e.errorCode,
      errorMessage: e.errorMessage,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      scannedAt: e.scannedAt?.toISOString?.() ?? e.scannedAt,
      scannedBy: e.userId ? userMap.get(e.userId) ?? null : null,
    }));

    return {
      ...this.mapTracker(serial),
      scanLogs: scanLogsWithUsers,
    };
  }

  private static mapTracker(s: any) {
    let timeToRedeemSeconds: number | null = null;
    if (s.dispatchedAt && s.redeemedAt) {
      const diff =
        new Date(s.redeemedAt).getTime() - new Date(s.dispatchedAt).getTime();
      if (isFinite(diff) && diff >= 0) timeToRedeemSeconds = Math.round(diff / 1000);
    }

    return {
      serialNumber: s.serialNumber,
      productId: s.productId,
      productTitle: s.product?.title ?? '—',
      status: s.status,
      dispatchedBy: s.dispatcher ?? null,
      dispatchedAt: s.dispatchedAt?.toISOString?.() ?? s.dispatchedAt ?? null,
      redeemedBy: s.redeemer ?? null,
      redeemedAt: s.redeemedAt?.toISOString?.() ?? s.redeemedAt ?? null,
      timeToRedeemSeconds,
      qrSignature: s.qrSignature,
      createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
    };
  }
}
