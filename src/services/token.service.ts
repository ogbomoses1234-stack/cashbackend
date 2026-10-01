import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { redis } from '../config/redis';
import type { Role } from '../types';

interface SignPublicOpts {
  userId: string;
  authId: string;
  role: Role;
}

export class TokenService {
  static signPublicAccessToken(opts: SignPublicOpts): string {
    const jti = randomUUID();
    return jwt.sign(
      { sub: opts.userId, authId: opts.authId, role: opts.role, jti },
      config.jwt.publicSecret,
      { expiresIn: config.jwt.accessTtl as any }
    );
  }

  static signAdminAccessToken(opts: { userId: string; sessionId: string; ip: string }): string {
    return jwt.sign(
      { sub: opts.userId, sessionId: opts.sessionId, ip: opts.ip, role: 'admin' },
      config.jwt.adminSecret,
      { expiresIn: '15m' }
    );
  }

  /** Revoke a public access token until its natural expiry (default 15m). */
  static async revokePublic(jti: string, ttlSeconds = 900): Promise<void> {
    await redis.set(`revoked:${jti}`, '1', 'EX', ttlSeconds);
  }

  static decodePublic<T = any>(token: string): T | null {
    try {
      return jwt.verify(token, config.jwt.publicSecret) as T;
    } catch {
      return null;
    }
  }
}
