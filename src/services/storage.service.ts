import crypto from 'crypto';
import { minio, BUCKETS, PRESIGNED_URL_TTL } from '../config/storage';
import { ApiError } from '../utils/ApiError';
import { logger } from '../config/logger';

export class StorageService {
  static bucketName(kind: 'public' | 'private'): string {
    return kind === 'public' ? BUCKETS.public : BUCKETS.private;
  }

  static async getUploadUrl(params: {
    bucket: 'public' | 'private';
    objectKey: string;
    contentType: string;
    expiresIn?: number;
  }) {
    try {
      const url = await minio.presignedPutObject(
        this.bucketName(params.bucket),
        params.objectKey,
        params.expiresIn ?? PRESIGNED_URL_TTL.UPLOAD
      );
      return {
        uploadUrl: url,
        objectKey: params.objectKey,
        bucket: this.bucketName(params.bucket),
      };
    } catch (err) {
      logger.error('MinIO presigned PUT failed', err);
      throw ApiError.internal('STORAGE_ERROR', 'Could not prepare upload');
    }
  }

  static async getDownloadUrl(params: {
    bucket: 'public' | 'private';
    objectKey: string;
    expiresIn?: number;
  }): Promise<string> {
    try {
      return await minio.presignedGetObject(
        this.bucketName(params.bucket),
        params.objectKey,
        params.expiresIn ?? PRESIGNED_URL_TTL.DOWNLOAD_SHORT
      );
    } catch (err) {
      logger.error('MinIO presigned GET failed', err);
      throw ApiError.internal('STORAGE_ERROR', 'Could not fetch media');
    }
  }

  static async putBuffer(params: {
    bucket: 'public' | 'private';
    objectKey: string;
    buffer: Buffer;
    contentType: string;
    cacheControl?: string;
  }) {
    await minio.putObject(
      this.bucketName(params.bucket),
      params.objectKey,
      params.buffer,
      params.buffer.length,
      {
        'Content-Type': params.contentType,
        ...(params.cacheControl ? { 'Cache-Control': params.cacheControl } : {}),
      }
    );
    return { objectKey: params.objectKey };
  }

  static async statObject(bucket: 'public' | 'private', objectKey: string) {
    try {
      return await minio.statObject(this.bucketName(bucket), objectKey);
    } catch (err: any) {
      if (err?.code === 'NotFound') {
        throw ApiError.notFound('FILE_NOT_FOUND', 'File not found');
      }
      throw err;
    }
  }

  static async deleteObject(bucket: 'public' | 'private', objectKey: string) {
    try {
      await minio.removeObject(this.bucketName(bucket), objectKey);
    } catch (err) {
      logger.warn('MinIO delete failed', { objectKey, err });
    }
  }

  /** Delete every object under a prefix — used for NDPR right-to-erasure. */
  static async deletePrefix(bucket: 'public' | 'private', prefix: string): Promise<void> {
    const bucketName = this.bucketName(bucket);
    const stream = minio.listObjectsV2(bucketName, prefix, true);

    return new Promise<void>((resolve, reject) => {
      const objects: string[] = [];
      stream.on('data', (obj) => obj.name && objects.push(obj.name));
      stream.on('end', async () => {
        if (objects.length === 0) return resolve();
        try {
          await minio.removeObjects(bucketName, objects);
          logger.info(`Deleted ${objects.length} objects under ${prefix}`);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      stream.on('error', reject);
    });
  }

  /** Build a canonical object key. Never trust client-supplied filenames. */
  static buildObjectKey(params: {
    namespace: string;
    scope?: string[];
    extension: string;
  }): string {
    const parts = [params.namespace, ...(params.scope ?? [])].filter(Boolean);
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${params.extension}`;
    parts.push(filename);
    return parts.join('/');
  }
}
