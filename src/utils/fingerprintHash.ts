import crypto from 'crypto';

export function hashFingerprint(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 64);
}
