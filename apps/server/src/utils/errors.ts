import { API_ERROR } from '../shared.js';

/**
 * Every error code this server emits.
 *
 * `API_ERROR` in the shared package holds the six the app actually branches on
 * and is locked; the transport-level codes below are server-local. They are
 * uppercase because the app compares against `API_ERROR`'s values, and a
 * lowercase code silently falls through to the generic "couldn't save" alert.
 */
export const ERROR = {
  ...API_ERROR,
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** A real account that a super admin has switched off. Distinct from
   *  BAD_CREDENTIALS so the sign-in screen can say why rather than implying
   *  the person mistyped their own password. */
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  CONFLICT: 'CONFLICT',
  /** Too many attempts from one address or against one email. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** An emailed reset/verify token that is expired, spent or made up. */
  INVALID_TOKEN: 'INVALID_TOKEN',
  /** Deleting this account would leave a mosque with nobody to run it. */
  LAST_COORDINATOR: 'LAST_COORDINATOR',
  /** The database is not reachable; the health check's 503. */
  UNAVAILABLE: 'UNAVAILABLE',
} as const;

/** Mongo's duplicate-key error, the second guard on the slot race. */
export function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === 11000;
}
