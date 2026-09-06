import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.string().default('dev'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  /** Only needed if Expo's push API starts rate-limiting us. */
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // Throw rather than `process.exit` — an exit inside a vitest worker surfaces
  // as an unattributable "worker terminated". `index.ts` catches and exits 1.
  const fields = JSON.stringify(parsed.error.flatten().fieldErrors);
  throw new Error(`Invalid environment configuration: ${fields}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
