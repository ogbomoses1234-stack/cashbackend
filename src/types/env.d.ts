declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT?: string;
    DATABASE_URL: string;
    REDIS_URL: string;
    ADMIN_REDIS_URL: string;
    PUBLIC_JWT_SECRET: string;
    ADMIN_JWT_SECRET: string;
    QR_SIGNING_SECRET: string;
    QR_BASE_URL: string;
    MINIO_ENDPOINT: string;
    MINIO_ACCESS_KEY: string;
    MINIO_SECRET_KEY: string;
  }
}
