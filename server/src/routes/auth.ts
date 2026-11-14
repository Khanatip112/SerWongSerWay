import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';
import { requireAuth, invalidatedTokens } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  const { email, password } = parseResult.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  // `jti` guarantees every login yields a distinct token, even within the same
  // second, so logging out one session cannot invalidate a newer login.
  const token = jwt.sign(
    { userId: user.id, role: user.role, jti: randomUUID() },
    config.SESSION_SECRET,
    { expiresIn: '24h' }
  );

  res.cookie('pastelpulse_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.status(200).json({
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.status(200).json({
    data: {
      id: req.user!.id,
      email: req.user!.email,
      fullName: req.user!.fullName,
      role: req.user!.role,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req: Request, res: Response): void => {
  const token = req.cookies?.pastelpulse_session;
  if (token) {
    invalidatedTokens.add(token);
  }

  res.clearCookie('pastelpulse_session', {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.NODE_ENV === 'production',
    path: '/',
  });

  res.status(200).json({
    data: {
      loggedOut: true,
    },
  });
});

export default router;
