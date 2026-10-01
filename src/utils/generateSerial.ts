import crypto from 'crypto';

export function generateSerial(): string {
  return crypto.randomBytes(5).toString('hex').toUpperCase();
}

export function generateBatchId(): string {
  return crypto.randomUUID();
}

export function generateOrderNumber(): string {
  const n = crypto.randomInt(10000, 99999);
  const t = Date.now().toString().slice(-5);
  return `QR-${t}${n}`;
}

export function generateStaffCode(): string {
  const n = crypto.randomInt(1000, 9999);
  return `STF-${n}`;
}
