import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { hashFingerprint } from '../utils/fingerprintHash';
import { ApiError } from '../utils/ApiError';

/**
 * Reads X-Device-Fingerprint header (raw client fingerprint),
 * hashes it, and rejects the request if that fingerprint is blocked.
 * Runs BEFORE authentication so deactivated users are blocked at the door.
 */
export async function checkDeviceBlocked(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers['x-device-fingerprint'];
  if (!raw || typeof raw !== 'string') return next();

  const hash = hashFingerprint(raw);
  const blocked = await prisma.userDevice.findFirst({
    where: { fingerprintHash: hash, blocked: true },
  });

  if (blocked) {
    return next(ApiError.forbidden('AUTH_DEVICE_BLOCKED', 'Access denied'));
  }
  req.fingerprintHash = hash;
  next();
}
