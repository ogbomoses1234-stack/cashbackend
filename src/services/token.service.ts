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

interface SignRefreshOpts {
  userId: string;
  jti: string;
  familyId: string;
}

interface RefreshPayload {
  sub: string;
  jti: string;
  familyId: string;
  iat: number;
  exp: number;
}

export class TokenService {
  /* ═══════════════════════════════════════════════════
     PUBLIC (customer / staff) ACCESS
  ═══════════════════════════════════════════════════ */
  static signPublicAccessToken(opts: SignPublicOpts): string {
    const jti = randomUUID();
    return jwt.sign(
      { sub: opts.userId, authId: opts.authId, role: opts.role, jti },
      config.jwt.publicSecret,
      { expiresIn: config.jwt.accessTtl as any }
    );
  }

  /* ═══════════════════════════════════════════════════
     ADMIN ACCESS
  ═══════════════════════════════════════════════════ */
  static signAdminAccessToken(opts: { userId: string; sessionId: string; ip: string }): string {
    return jwt.sign(
      { sub: opts.userId, sessionId: opts.sessionId, ip: opts.ip, role: 'admin' },
      config.jwt.adminSecret,
      { expiresIn: '15m' }
    );
  }

  /* ═══════════════════════════════════════════════════
     PUBLIC REFRESH (7d)
  ═══════════════════════════════════════════════════ */
  static signPublicRefreshToken(opts: SignRefreshOpts): string {
    return jwt.sign(
      { sub: opts.userId, jti: opts.jti, familyId: opts.familyId },
      config.jwt.publicSecret,
      { expiresIn: config.jwt.refreshTtl as any }
    );
  }

  static verifyPublicRefreshToken(token: string): RefreshPayload | null {
    try {
      return jwt.verify(token, config.jwt.publicSecret) as RefreshPayload;
    } catch {
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════
     ADMIN REFRESH (7d)
  ═══════════════════════════════════════════════════ */
  static signAdminRefreshToken(opts: {
    userId: string;
    jti: string;
    familyId: string;
    ip: string;
  }): string {
    return jwt.sign(
      { sub: opts.userId, jti: opts.jti, familyId: opts.familyId, ip: opts.ip },
      config.jwt.adminSecret,
      { expiresIn: config.jwt.refreshTtl as any }
    );
  }

  static verifyAdminRefreshToken(token: string): RefreshPayload | null {
    try {
      return jwt.verify(token, config.jwt.adminSecret) as RefreshPayload;
    } catch {
      return null;
    }
  }

  /* ═══════════════════════════════════════════════════
     REVOCATION
  ═══════════════════════════════════════════════════ */
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