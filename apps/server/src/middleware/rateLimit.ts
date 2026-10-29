import type { Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { ApiError } from '@m-ensemble/shared';
import { env, isTest } from '../config/env.js';
import { ERROR } from '../utils/errors.js';

/**
 * Request throttles. Two of them, both in-memory.
 *
 * In-memory is a deliberate first cut: this runs as one process, and a store
 * shared across replicas (Redis) is a dependency nobody has to operate yet.
 * When there is a second replica, swap the `store` here and nothing else.
 *
 * `trust proxy` must be set on the app or every caller behind the load
 * balancer shares one bucket — that line lives in `app.ts`.
 */

/** The header a test sets to opt in. Everything else under test is unthrottled. */
export const TEST_RATE_LIMIT_HEADER = 'x-test-rate-limit';

function skipUnderTest(req: Request): boolean {
  return isTest && req.headers[TEST_RATE_LIMIT_HEADER] !== '1';
}

function tooMany(_req: Request, res: Response): void {
  const body: ApiError = {
    ok: false,
    error: {
      code: ERROR.RATE_LIMITED,
      message: 'Too many attempts. Wait a few minutes and try again.',
    },
  };
  res.status(429).json(body);
}

const common = {
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  skip: skipUnderTest,
  handler: tooMany,
};

/** Per IP, on the routes that mint or change credentials. */
const authByIp = rateLimit({ ...common, limit: env.RATE_LIMIT_AUTH_MAX });

/**
 * Per email, on login and forgot-password. The IP limiter alone lets a
 * botnet spread a password-guessing run across addresses; keying on the
 * target closes that. Requests with no email fall back to the IP bucket.
 */
const authByEmail = rateLimit({
  ...common,
  limit: env.RATE_LIMIT_AUTH_MAX,
  keyGenerator: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' && email.trim()
      ? `email:${email.trim().toLowerCase()}`
      : `ip:${req.ip ?? 'unknown'}`;
  },
  // The library insists a custom key uses its IPv6-aware helper; the key here
  // is an email, so that check does not apply.
  validate: { keyGeneratorIpFallback: false },
});

/** Mounted on every `/auth` write. */
export const authLimiter = [authByIp, authByEmail];

/** The general throttle for everything under `/api`. Mounted in `app.ts`. */
export const apiLimiter = rateLimit({ ...common, limit: env.RATE_LIMIT_API_MAX });
