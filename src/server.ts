import 'dotenv/config';
import { createApp } from './app';
import { config } from './config';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { verifyMailer } from './config/mailer';
import { ensureBuckets } from './config/storage';
import { startScheduler } from './jobs/scheduler';

async function bootstrap() {
  logger.info(`🚀 Booting QR CashBack Connect API (env=${config.env})`);

  // 1. Database
  await connectDatabase();

  // 2. Mailer (soft-fail in dev)
  await verifyMailer().catch((err) => logger.warn('Mailer init failed', err));

  // 3. MinIO buckets (idempotent)
  await ensureBuckets().catch((err) => logger.warn('MinIO bucket init failed', err));

  // 4. Express
  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info(`✅ API listening on port ${config.port}`);
    logger.info(`   Public:  http://localhost:${config.port}/api/public`);
    logger.info(`   Admin:   http://localhost:${config.port}/api/admin`);
    logger.info(`   Health:  http://localhost:${config.port}/api/health`);
  });

  // 5. Background jobs
  startScheduler();

  // 6. Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase().catch(() => {});
      logger.info('👋 Shutdown complete');
      process.exit(0);
    });

    // Force kill after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error('Boot failure', err);
  process.exit(1);
});
