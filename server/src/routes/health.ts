import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';

const router = Router();

// GET /api/health - Basic process liveness probe
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// GET /api/ready - Readiness probe checking PostgreSQL database connectivity
router.get('/ready', async (_req: Request, res: Response) => {
  try {
    // Perform a lightweight query to verify active database connection
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ready',
      database: 'connected',
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'unavailable',
      database: 'disconnected',
      error: 'Database connection failed',
    });
  }
});

export default router;
