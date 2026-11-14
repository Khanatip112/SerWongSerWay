import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: config.DATABASE_URL,
      },
    },
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
