import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  PUBLIC_DOMAIN: z.string(),
  ADMIN_DOMAIN: z.string(),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ADMIN_REDIS_URL: z.string().min(1),

  PUBLIC_JWT_SECRET: z.string().min(32),
  ADMIN_JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  QR_SIGNING_SECRET: z.string().min(32),
  QR_BASE_URL: z.string(),

  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().default('587'),
  SMTP_SECURE: z.string().default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string(),

  PAYSTACK_SECRET_KEY: z.string().optional().default(''),

  MINIO_ENDPOINT: z.string(),
  MINIO_PORT: z.string().default('9000'),
  MINIO_USE_SSL: z.string().default('false'),
  MINIO_REGION: z.string().default('us-east-1'),
  MINIO_ACCESS_KEY: z.string(),
  MINIO_SECRET_KEY: z.string(),
  MINIO_BUCKET_PUBLIC: z.string().default('qrcb-public'),
  MINIO_BUCKET_PRIVATE: z.string().default('qrcb-private'),
  MINIO_PUBLIC_URL: z.string(),
  MINIO_SERVER_URL: z.string().optional(),

  CORS_PUBLIC_ORIGIN: z.string(),
  CORS_ADMIN_ORIGIN: z.string(),

  CASHBACK_AMOUNT: z.string().default('100'),
  MIN_WITHDRAWAL: z.string().default('100'),
  SCAN_RATE_LIMIT: z.string().default('3'),
  SCAN_LOCKOUT_MINUTES: z.string().default('10'),
  OTP_TTL_MINUTES: z.string().default('5'),
  OTP_MAX_ATTEMPTS: z.string().default('5'),
  DEV_AUTO_DISPATCH: z.string().default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parseInt(parsed.data.PORT, 10),
  isProd: parsed.data.NODE_ENV === 'production',

  domains: {
    public: parsed.data.PUBLIC_DOMAIN,
    admin: parsed.data.ADMIN_DOMAIN,
  },

  db: { url: parsed.data.DATABASE_URL },

  redis: {
    publicUrl: parsed.data.REDIS_URL,
    adminUrl: parsed.data.ADMIN_REDIS_URL,
  },

  jwt: {
    publicSecret: parsed.data.PUBLIC_JWT_SECRET,
    adminSecret: parsed.data.ADMIN_JWT_SECRET,
    accessTtl: parsed.data.JWT_ACCESS_TTL,
    refreshTtl: parsed.data.JWT_REFRESH_TTL,
  },

  qr: {
    signingSecret: parsed.data.QR_SIGNING_SECRET,
    baseUrl: parsed.data.QR_BASE_URL,
  },

  mail: {
    host: parsed.data.SMTP_HOST,
    port: parseInt(parsed.data.SMTP_PORT, 10),
    secure: parsed.data.SMTP_SECURE === 'true',
    user: parsed.data.SMTP_USER,
    pass: parsed.data.SMTP_PASS,
    from: parsed.data.MAIL_FROM,
  },

  paystack: { secretKey: parsed.data.PAYSTACK_SECRET_KEY },

  minio: {
    endpoint: parsed.data.MINIO_ENDPOINT,
    port: parseInt(parsed.data.MINIO_PORT, 10),
    useSSL: parsed.data.MINIO_USE_SSL === 'true',
    region: parsed.data.MINIO_REGION,
    accessKey: parsed.data.MINIO_ACCESS_KEY,
    secretKey: parsed.data.MINIO_SECRET_KEY,
    buckets: {
      public: parsed.data.MINIO_BUCKET_PUBLIC,
      private: parsed.data.MINIO_BUCKET_PRIVATE,
    },
    publicUrl: parsed.data.MINIO_PUBLIC_URL,
    serverUrl: parsed.data.MINIO_SERVER_URL,
  },

  cors: {
    publicOrigin: parsed.data.CORS_PUBLIC_ORIGIN,
    adminOrigin: parsed.data.CORS_ADMIN_ORIGIN,
  },

  business: {
    cashbackAmount: parseInt(parsed.data.CASHBACK_AMOUNT, 10),
    minWithdrawal: parseInt(parsed.data.MIN_WITHDRAWAL, 10),
    scanRateLimit: parseInt(parsed.data.SCAN_RATE_LIMIT, 10),
    scanLockoutMinutes: parseInt(parsed.data.SCAN_LOCKOUT_MINUTES, 10),
    otpTtlMinutes: parseInt(parsed.data.OTP_TTL_MINUTES, 10),
    otpMaxAttempts: parseInt(parsed.data.OTP_MAX_ATTEMPTS, 10),
    devAutoDispatch: parsed.data.DEV_AUTO_DISPATCH === 'true',
  },
} as const;
