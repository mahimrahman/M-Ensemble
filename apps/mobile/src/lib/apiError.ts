import { ApiRequestError } from '@/api/client';
import type { Strings } from '@/i18n';

/**
 * The message a form shows for a failed request.
 *
 * The server's own wording is normally the right one — it knows why it said
 * no. Two cases are translated here instead: a rate limit, whose server text
 * is written for a log rather than a person, and anything that is not an
 * `ApiRequestError` at all, which gets the screen's own fallback in the app's
 * language rather than a raw `TypeError`.
 */
export function describeApiError(err: unknown, t: Strings, fallback: string): string {
  if (!(err instanceof ApiRequestError)) return fallback;
  if (err.code === 'RATE_LIMITED' || err.status === 429) return t.rateLimited;
  return err.message || fallback;
}
