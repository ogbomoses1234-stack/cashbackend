import { Client as MinioClient } from 'minio';
import { config } from './index';
import { logger } from './logger';

/**
 * Internal client — talks to RustFS inside the Docker network.
 * Used for: makeBucket, statObject, putObject, removeObject, listObjects.
 */
export const minio = new MinioClient({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
});

/**
 * Public client — used ONLY for generating presigned URLs.
 * The endpoint matches the public URL the browser will hit.
 *
 * The browser gets: https://<public-host>/<bucket>/<key>?X-Amz-Signature=...
 * The signature was computed with that exact host, so it validates.
 */
export const minioPublic = new MinioClient({
  endPoint: config.minio.publicEndpoint.host,
  port: config.minio.publicEndpoint.port,
  useSSL: config.minio.publicEndpoint.ssl,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
  region: config.minio.region,
});

logger.info('📦 MinIO internal endpoint: ' + config.minio.endpoint + ':' + config.minio.port);
logger.info('📦 MinIO public endpoint:   ' + (config.minio.publicEndpoint.ssl ? 'https' : 'http') + '://' + config.minio.publicEndpoint.host + ':' + config.minio.publicEndpoint.port);

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
