import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase() {
  await prisma.$connect();
  logger.info('✅ Database connected');
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}
