import { prisma } from '../config/database';
import { minio, BUCKETS } from '../config/storage';
import { logger } from '../config/logger';

/**
 * Delete objects in qrcb-private that have no DB reference and are older than 24h.
 * Runs nightly. Only scans the top of each known prefix to stay cheap.
 */
export async function cleanupOrphanedUploads() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const prefixes = ['receipts/', 'disputes/', 'chat-attachments/'];

  let scanned = 0;
  let deleted = 0;

  for (const prefix of prefixes) {
    const stream = minio.listObjectsV2(BUCKETS.private, prefix, true);

    for await (const obj of stream) {
      if (!obj.name || !obj.lastModified) continue;
      if (obj.lastModified.getTime() > cutoff) continue;
      scanned++;

      const inOrders = await prisma.order.count({ where: { receiptObjectKey: obj.name } });
      const inDisputes = await prisma.disputeReport.count({
        where: { photoObjectKey: obj.name },
      });
      const inChat = await prisma.chatMessage.count({
        where: { attachmentKey: obj.name },
      });

      if (inOrders + inDisputes + inChat === 0) {
        await minio.removeObject(BUCKETS.private, obj.name).catch(() => {});
        deleted++;
      }
    }
  }

  logger.info(`Orphan upload cleanup: scanned=${scanned} deleted=${deleted}`);
}
