import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export const redis = new Redis(config.redis.publicUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

export const adminRedis = new Redis(config.redis.adminUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on('connect', () => logger.info('✅ Redis (public) connected'));
redis.on('error', (err) => logger.error('Redis public error', err));

adminRedis.on('connect', () => logger.info('✅ Redis (admin) connected'));
adminRedis.on('error', (err) => logger.error('Redis admin error', err));
