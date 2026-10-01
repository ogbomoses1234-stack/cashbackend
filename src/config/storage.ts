import { Client as MinioClient } from 'minio';
import { config } from './index';
import { logger } from './logger';

export const minio = new MinioClient({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
});

export const BUCKETS = config.minio.buckets;

export const PRESIGNED_URL_TTL = {
  UPLOAD: 60 * 5,
  DOWNLOAD_SHORT: 60 * 5,
  DOWNLOAD_LONG: 60 * 60,
} as const;

export async function ensureBuckets() {
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await minio.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await minio.makeBucket(bucket, config.minio.region);
      logger.info(`✅ Created bucket: ${bucket}`);
    } else {
      logger.info(`✅ Bucket ready: ${bucket}`);
    }
  }
}
