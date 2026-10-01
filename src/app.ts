import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import publicRoutes from './routes/public';
import adminRoutes from './routes/admin';

import { requestId } from './middleware/requestId.middleware';
import { publicCors, adminCors } from './middleware/cors.middleware';
import { notFound } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';

export function createApp(): Express {
  const app = express();

  // Trust proxy (for correct req.ip behind Nginx)
  app.set('trust proxy', 1);

  // Core middleware
  app.use(requestId);
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Health check (no auth, no CORS restrictions)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Public API — separate CORS + separate auth
  app.use('/api/public', publicCors, publicRoutes);

  // Admin API — separate CORS + separate auth
  app.use('/api/admin', adminCors, adminRoutes);

  // 404 + error handler (must be last)
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
