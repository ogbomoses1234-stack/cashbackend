import 'express';

declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: {
        sub: string;
        authId: string;
        role: 'customer' | 'staff' | 'admin';
        jti: string;
        iat: number;
        exp: number;
      };
      admin?: {
        sub: string;
        sessionId: string;
        ip: string;
        role: 'admin';
        iat: number;
        exp: number;
      };
      fingerprintHash?: string;
      validatedQuery?: Record<string, unknown>;
      validatedParams?: Record<string, unknown>;
    }
  }
}

export {};
