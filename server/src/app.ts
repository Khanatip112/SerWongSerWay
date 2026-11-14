import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import healthRouter from './routes/health.js';

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

  // 404 handler for unmatched API routes
  app.use('/api/*', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  return app;
}

export default createApp;
