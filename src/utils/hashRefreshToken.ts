import crypto from 'crypto';

/**
 * SHA-256 hash of a refresh token for at-rest storage.
 * Refresh tokens are already high-entropy JWTs — hashing with a fast function
 * (not argon2) is correct here. Argon2 would make DB lookups too slow.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}