import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('4000')
    .transform((val) => parseInt(val, 10)),
  DATABASE_URL: z
    .string()
    .default('postgresql://postgres:postgres@localhost:5432/pastelpulse?schema=public'),
  SESSION_SECRET: z
    .string()
    .default('pastelpulse_default_development_secret_key_12345'),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  throw new Error('Environment configuration validation failed');
}

function resolveDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'test') {
    if (
      process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.includes('localhost:5432') &&
      !process.env.DATABASE_URL.includes('127.0.0.1:5432')
    ) {
      return process.env.DATABASE_URL;
    }
    return 'postgresql://postgres:postgres@localhost:5433/pastelpulse?schema=public';
  }
  return (
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/pastelpulse?schema=public'
  );
}

export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : parsedEnv.data.PORT,
  DATABASE_URL: resolveDatabaseUrl(),
  SESSION_SECRET: process.env.SESSION_SECRET || parsedEnv.data.SESSION_SECRET,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || parsedEnv.data.CLIENT_ORIGIN,
  NODE_ENV: (process.env.NODE_ENV as 'development' | 'test' | 'production') || parsedEnv.data.NODE_ENV,
};
