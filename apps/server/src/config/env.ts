import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  /** Comma-separated origins, or `*`. Refused in production. */
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.string().default('dev'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  /** Only needed if Expo's push API starts rate-limiting us. */
  EXPO_ACCESS_TOKEN: z.string().optional(),

  // ─── Where things live ────────────────────────────────────────────────────
  /** The API's own public origin, e.g. `https://api.mensemble.ca`. Used in emails and Stripe redirects. */
  PUBLIC_API_URL: z.string().url().optional(),
  /** The marketing/legal site, e.g. `https://mensemble.ca`. Emails link here. */
  PUBLIC_WEB_URL: z.string().url().optional(),
  /** The console's origin, for links in operator emails. */
  PUBLIC_ADMIN_URL: z.string().url().optional(),
  /** The app's deep-link scheme. Matches `app.json`. */
  APP_SCHEME: z.string().default('mensemble'),

  // ─── Uploads ──────────────────────────────────────────────────────────────
  /**
   * Where uploaded posters are written when no bucket is configured. Relative
   * by default so a fresh clone needs no configuration; in production set the
   * S3 variables below instead, because a container's filesystem does not
   * survive a redeploy.
   */
  UPLOAD_DIR: z.string().default('./uploads'),
  /** S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). All four or none. */
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default('auto'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL the bucket is served from, e.g. a CDN. Required with S3_BUCKET. */
  S3_PUBLIC_URL: z.string().url().optional(),
  /** Uploads per user per day. */
  UPLOAD_DAILY_QUOTA: z.coerce.number().int().positive().default(50),

  // ─── Email ────────────────────────────────────────────────────────────────
  /** `resend`, `smtp` or `console`. `console` prints to the log and is refused in production. */
  EMAIL_PROVIDER: z.enum(['resend', 'smtp', 'console']).default('console'),
  EMAIL_FROM: z.string().default("M'Ensemble <no-reply@mensemble.app>"),
  /** Where replies and support requests go. Shown in every email footer. */
  SUPPORT_EMAIL: z.string().email().default('support@mensemble.app'),
  RESEND_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: bool,

  // ─── Stripe ───────────────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Let Stripe Tax compute GST/QST/HST from the customer's address. */
  STRIPE_AUTOMATIC_TAX: bool,
  /** Fallback when automatic tax is off: comma-separated Stripe tax rate ids (txr_…). */
  STRIPE_TAX_RATE_IDS: z.string().optional(),
  /** Stripe Connect Express account country for mosques. */
  STRIPE_CONNECT_COUNTRY: z.string().length(2).default('CA'),

  // ─── Observability ────────────────────────────────────────────────────────
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  // ─── Rate limits (requests per window per IP) ─────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(600),

  // ─── Session ──────────────────────────────────────────────────────────────
  /** How long a sign-in lasts without being revoked. */
  TOKEN_TTL: z.string().default('30d'),

  // ─── The super-admin console ──────────────────────────────────────────────
  SUPERADMIN_EMAIL: z.string().email().default('admin@mensemble.app'),
  SUPERADMIN_PASSWORD: z.string().min(6).default('mensemble-admin'),
  SUPERADMIN_NAME: z.string().default('Platform Admin'),

  /** Set to `true` to allow the seed to run against a production database. */
  ALLOW_SEED_IN_PRODUCTION: bool,
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
export const isTest = env.NODE_ENV === 'test';

/**
 * Settings that are fine on a laptop and dangerous on a server.
 *
 * Checked in production only, and every problem is reported at once rather
 * than one per restart. The process refuses to start: a server that boots
 * with `JWT_SECRET=change-me` is one anyone can mint sessions for.
 */
export function assertProductionConfig(): void {
  if (!isProduction) return;
  const problems: string[] = [];

  const weakSecrets = new Set(['change-me', 'secret', 'jwt-secret', 'test-secret-not-a-real-one']);
  if (env.JWT_SECRET.length < 32 || weakSecrets.has(env.JWT_SECRET.toLowerCase())) {
    problems.push('JWT_SECRET must be at least 32 random characters');
  }
  if (env.CORS_ORIGIN === '*') {
    problems.push('CORS_ORIGIN must list the console and web origins, not *');
  }
  if (env.SUPERADMIN_PASSWORD === 'mensemble-admin' || env.SUPERADMIN_PASSWORD.length < 12) {
    problems.push('SUPERADMIN_PASSWORD must be changed from the default and be 12+ characters');
  }
  if (env.SUPERADMIN_EMAIL === 'admin@mensemble.app') {
    problems.push('SUPERADMIN_EMAIL must be a real mailbox you control');
  }
  if (env.EMAIL_PROVIDER === 'console') {
    problems.push('EMAIL_PROVIDER must be resend or smtp (password resets need real email)');
  }
  if (!env.PUBLIC_API_URL || !env.PUBLIC_API_URL.startsWith('https://')) {
    problems.push('PUBLIC_API_URL must be set and use https');
  }
  if (!env.PUBLIC_WEB_URL) {
    problems.push('PUBLIC_WEB_URL must be set (legal links in emails and the app)');
  }
  if (!env.S3_BUCKET) {
    problems.push('S3_BUCKET (and S3_* credentials) must be set so uploads survive a redeploy');
  }
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET) {
    problems.push('STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is set');
  }
  if (env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    problems.push('STRIPE_SECRET_KEY is a test key');
  }
  if (!env.SENTRY_DSN) {
    problems.push('SENTRY_DSN must be set so production errors are seen');
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to start in production:\n  - ${problems.join('\n  - ')}\n` +
        'Fix the environment, or run with NODE_ENV=development on a machine that is not a server.',
    );
  }
}

/** Whether the S3 path is configured. */
export const hasS3 = Boolean(
  env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_PUBLIC_URL,
);

/** Whether Stripe is configured at all. Routes that need it 503 otherwise. */
export const hasStripe = Boolean(env.STRIPE_SECRET_KEY);
