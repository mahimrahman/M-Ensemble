import type { Response } from 'express';
import type { ApiSuccess } from '@m-ensemble/shared';

/**
 * The success half of the envelope.
 *
 * **Never send 204.** The HTTP client calls `res.json()` on every response
 * without checking the status, so a bodyless reply throws inside the client
 * before any screen sees it. Void endpoints send `{ ok: true, data: null }`
 * with a 200 — that is what `okNull` is for.
 */
export function ok<T>(res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { ok: true, data };
  res.status(status).json(body);
}

/** For the endpoints the contract types as `Promise<void>`. */
export function okNull(res: Response): void {
  ok(res, null);
}
