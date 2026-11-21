import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';

import { config } from './config/index.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import campaignsRouter from './routes/campaigns.js';

// Production: /app/client/dist
// Local development: <repo>/client/dist
const clientDistPath = resolve(__dirname, '../../client/dist');

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: config.CLIENT_ORIGIN,
      credentials: true,
    })
  );

  app.use(cookieParser());
  app.use(express.json());

  // Mount API endpoints
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/campaigns', campaignsRouter);

  // 404 handler for unmatched API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Serve React static files
  app.use(express.static(clientDistPath));

  // React SPA fallback for client-side routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    }

    res.sendFile(resolve(clientDistPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  return app;
}

export default createApp;
