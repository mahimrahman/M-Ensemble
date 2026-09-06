import { API_ERROR } from '../shared.js';

/**
 * Every error code this server emits.
 *
 * `API_ERROR` in the shared package holds the six the app actually branches on
 * and is locked; the three transport-level codes below are server-local. They
 * are uppercase because the app compares against `API_ERROR`'s values, and a
 * lowercase code silently falls through to the generic "couldn't save" alert.
 */
export const ERROR = {
  ...API_ERROR,
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/** Mongo's duplicate-key error, the second guard on the slot race. */
export function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === 11000;
}
