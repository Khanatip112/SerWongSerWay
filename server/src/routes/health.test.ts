import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../db/prisma.js';

describe('Health and Readiness Endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 OK with status ok', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /api/ready', () => {
    it('should return 200 OK when database connection succeeds', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValueOnce([{ '?column?': 1 }]);

      const res = await request(app).get('/api/ready');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: 'ready',
        database: 'connected',
      });
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should return 503 Service Unavailable when database connection fails', async () => {
      vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('Connection refused'));

      const res = await request(app).get('/api/ready');

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        status: 'unavailable',
        database: 'disconnected',
        error: 'Database connection failed',
      });
    });
  });

  describe('404 on unknown /api route', () => {
    it('should return 404 for unknown API endpoints', async () => {
      const res = await request(app).get('/api/unknown-endpoint');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Endpoint not found',
        },
      });
    });
  });
});
