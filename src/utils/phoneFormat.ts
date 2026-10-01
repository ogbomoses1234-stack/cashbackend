/**
 * Normalize a Nigerian phone to +234XXXXXXXXXX.
 * Accepts: 08031234567, 8031234567, +2348031234567, 2348031234567.
 * Returns null if invalid.
 */
export function normalizeNgPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let rest = digits;
  if (rest.startsWith('234')) rest = rest.slice(3);
  else if (rest.startsWith('0')) rest = rest.slice(1);

  if (!/^[789]\d{9}$/.test(rest)) return null;
  return `+234${rest}`;
}
