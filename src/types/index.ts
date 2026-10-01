export type Role = 'customer' | 'staff' | 'admin';

export interface AuthUserPayload {
  sub: string;
  authId: string;
  role: Role;
  jti: string;
  iat: number;
  exp: number;
}

export interface AdminPayload {
  sub: string;
  sessionId: string;
  ip: string;
  role: 'admin';
  iat: number;
  exp: number;
}
