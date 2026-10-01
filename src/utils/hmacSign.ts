import crypto from 'crypto';
import { config } from '../config';

export function signSerial(serial: string): string {
  return crypto
    .createHmac('sha256', config.qr.signingSecret)
    .update(serial)
    .digest('hex')
    .slice(0, 32);
}

export function verifySerialSignature(serial: string, signature: string): boolean {
  const expected = signSerial(serial);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function buildQrUrl(serial: string): string {
  const sig = signSerial(serial);
  return `${config.qr.baseUrl.replace(/\/$/, '')}/scan/${serial}?sig=${sig}`;
}
