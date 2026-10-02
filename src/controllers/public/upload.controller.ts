import { Request, Response } from 'express';
import mime from 'mime-types';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiResponse } from '../../utils/ApiResponse';
import { StorageService } from '../../services/storage.service';
import { MEDIA_NAMESPACES, UPLOAD_RULES } from '../../config/constants';
import { ApiError } from '../../utils/ApiError';
import { redis } from '../../config/redis';

export const requestPresign = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user || (req as any).admin;
  if (!user) throw ApiError.unauthorized();
  const { purpose, mimeType, sizeBytes, scope } = req.body;

  if (!UPLOAD_RULES.ALLOWED_MIME.includes(mimeType)) {
    throw ApiError.badRequest('UPLOAD_INVALID_TYPE', 'Only JPG, PNG, WebP or PDF allowed');
  }
  if (sizeBytes > UPLOAD_RULES.MAX_SIZE_BYTES) {
    throw ApiError.badRequest('UPLOAD_TOO_LARGE', 'File exceeds 5 MB limit');
  }

  const limitMap: Record<string, number> = {
    receipt: UPLOAD_RULES.RECEIPT_MAX_PER_HOUR,
    dispute: UPLOAD_RULES.DISPUTE_MAX_PER_HOUR,
    chat: UPLOAD_RULES.CHAT_ATTACHMENT_MAX_PER_HOUR,
    avatar: 3,
    product: 20,
  };
  const rlKey = `upload_rate:${user.sub}:${purpose}:${Math.floor(Date.now() / 3600000)}`;
  const count = await redis.incr(rlKey);
  await redis.expire(rlKey, 3600);
  if (count > limitMap[purpose]) {
    throw ApiError.tooMany('UPLOAD_RATE_LIMIT', 'Too many uploads');
  }

  const ext = (mime.extension(mimeType) as string) || 'bin';

  let bucket: 'public' | 'private' = 'private';
  let namespace = '';
  let keyScope: string[] = [];

  switch (purpose) {
    case 'receipt':
      namespace = MEDIA_NAMESPACES.RECEIPTS;
      keyScope = [user.sub, scope?.orderId || 'unsorted'];
      break;
    case 'dispute':
      namespace = MEDIA_NAMESPACES.DISPUTES;
      keyScope = [user.sub, scope?.disputeId || 'unsorted'];
      break;
    case 'chat':
      namespace = MEDIA_NAMESPACES.CHAT;
      keyScope = [scope?.threadId || 'general', scope?.messageId || 'pending'];
      break;
    case 'product':
      bucket = 'public';
      namespace = MEDIA_NAMESPACES.PRODUCTS;
      keyScope = [scope?.productId || 'unsorted'];
      break;
    case 'avatar':
      bucket = 'public';
      namespace = MEDIA_NAMESPACES.AVATARS;
      keyScope = [user.sub];
      break;
  }

  const objectKey = StorageService.buildObjectKey({
    namespace,
    scope: keyScope,
    extension: `.${ext}`,
  });

  const { uploadUrl } = await StorageService.getUploadUrl({
    bucket,
    objectKey,
    contentType: mimeType,
  });

  await redis.set(
    `pending_upload:${user.sub}:${objectKey}`,
    JSON.stringify({ purpose, mimeType, sizeBytes, bucket, ts: Date.now() }),
    'EX',
    600
  );

  return ApiResponse.success(res, { uploadUrl, objectKey, bucket, expiresIn: 300 });
});

export const commitUpload = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user || (req as any).admin;
  if (!user) throw ApiError.unauthorized();
  const { objectKey } = req.body;

  const pendingRaw = await redis.get(`pending_upload:${user.sub}:${objectKey}`);
  if (!pendingRaw) {
    throw ApiError.badRequest('UPLOAD_NOT_PENDING', 'Upload session expired or invalid');
  }
  const pending = JSON.parse(pendingRaw) as { bucket: 'public' | 'private' };

  const stat = await StorageService.statObject(pending.bucket, objectKey);
  if (stat.size > UPLOAD_RULES.MAX_SIZE_BYTES) {
    await StorageService.deleteObject(pending.bucket, objectKey);
    throw ApiError.badRequest('UPLOAD_TOO_LARGE', 'Uploaded file exceeds size limit');
  }

  await redis.del(`pending_upload:${user.sub}:${objectKey}`);

  return ApiResponse.success(res, {
    objectKey,
    size: stat.size,
    contentType: stat.metaData?.['content-type'],
    committed: true,
  });
});

export const getSignedUrl = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user || (req as any).admin;
  if (!user) throw ApiError.unauthorized();
  const objectKey = decodeURIComponent(req.params.objectKey);
  const longLived = req.query.longLived === 'true';

  const isOwner = objectKey.includes(`/${user.sub}/`);
  if (!isOwner && user.role !== 'admin') throw ApiError.forbidden();

  const url = await StorageService.getDownloadUrl({
    bucket: 'private',
    objectKey,
    expiresIn: longLived ? 3600 : 300,
  });
  return ApiResponse.success(res, { url });
});
