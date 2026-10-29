import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';
import type { ApiError } from '@m-ensemble/shared';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(_req: Request, res: Response): void {
  const body: ApiError = {
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  };
  res.status(404).json(body);
}

/**
 * The last middleware. An `HttpError` is the handler saying something it meant
 * to say and goes out as-is; anything else is a bug and goes out as a generic
 * 500 — the message and stack stay in the log and in Sentry, never in the
 * response. Express's own body-parser errors are the one other shape worth
 * naming, so malformed JSON is a 400 rather than a 500 that pages someone.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    if (err.status >= 500) logger.error({ err, path: req.path }, '[error] %s', err.code);
    const body: ApiError = {
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    };
    res.status(err.status).json(body);
    return;
  }

  const parse = err as { type?: string; status?: number } | null;
  if (parse?.type === 'entity.parse.failed' || parse?.type === 'entity.too.large') {
    const body: ApiError = {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Malformed request body' },
    };
    res.status(parse.status ?? 400).json(body);
    return;
  }

  logger.error({ err, method: req.method, path: req.path }, '[error] unhandled');
  if (env.SENTRY_DSN) Sentry.captureException(err);

  const body: ApiError = {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  };
  res.status(500).json(body);
}
