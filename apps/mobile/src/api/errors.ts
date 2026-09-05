import { API_ERROR, type ApiErrorCode } from '@/types';

/**
 * The only error type screens have to know about. Both the mock client and the
 * HTTP client throw it, with the same codes, so error handling written in
 * PHASE 2 still works in PHASE 5.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiErrorCode | string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export function isApiError(err: unknown, code: ApiErrorCode): boolean {
  return err instanceof ApiRequestError && err.code === code;
}

export { API_ERROR };
