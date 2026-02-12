import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_VIEWER_SECRET: z.string().min(16),
  JWT_ADMIN_SECRET: z.string().min(16),
  VIEWER_TOKEN_TTL: z.string().default('8h'),
  ADMIN_TOKEN_TTL: z.string().default('12h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  STREAM_PUBLIC_BASE_URL: z.string().url(),
  SESSION_STALE_SECONDS: z.coerce.number().default(45),
  HEARTBEAT_SECONDS: z.coerce.number().default(20),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
