import path from 'path';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Detect the true MIME type from magic bytes using file-type v19 (ESM-only).
 * Uses a dynamic import so this file can remain CommonJS-compatible.
 */
export async function validateMagicBytes(buffer: Buffer) {
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) return { valid: false as const };
  return {
    valid: ALLOWED.includes(detected.mime),
    detectedMime: detected.mime,
  };
}

export function sanitizeFilename(filename: string): string {
  const base = path.basename(filename);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export function hasDoubleExtension(filename: string): boolean {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 3) return false;
  const suspicious = ['php', 'phtml', 'exe', 'sh', 'bat', 'js', 'html'];
  return suspicious.some((ext) => parts.slice(1).includes(ext));
}
