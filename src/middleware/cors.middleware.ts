import cors from 'cors';
import { config } from '../config';

function parseOrigins(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const PUBLIC_ORIGINS = parseOrigins(config.cors.publicOrigin);
const ADMIN_ORIGINS = parseOrigins(config.cors.adminOrigin);

function makeOriginChecker(allowed: string[]) {
  return (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void
  ) => {
    // Allow requests with no origin (curl, Postman, same-origin)
    if (!origin) return cb(null, true);
    if (allowed.includes(origin)) return cb(null, true);
    // Allow LAN / private IP variants for local dev
    if (/^http:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  };
}

export const publicCors = cors({
  origin: makeOriginChecker(PUBLIC_ORIGINS),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Device-Fingerprint',
    'X-Request-Id',
  ],
});

export const adminCors = cors({
  origin: makeOriginChecker(ADMIN_ORIGINS),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
});
