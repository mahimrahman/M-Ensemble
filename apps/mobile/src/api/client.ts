/**
 * The one door out of the UI.
 *
 * No screen calls `fetch`. No screen knows anything about transport - that is
 * what kept swapping the implementation cheap while the app was being built.
 *
 * **The app talks to the real server. There is no mock path any more.**
 *
 * The in-memory mock client served PHASE 1-4, and it did real damage on the way
 * out: it was the *default* (mocks unless `EXPO_PUBLIC_USE_MOCKS` said
 * otherwise), its state lived only in the JS bundle, and an account created
 * against it looked like it worked and then vanished on the next reload. A flag
 * that silently decides whether your signup is real is not a flag worth having,
 * so the choice is gone rather than merely flipped.
 *
 * The mock still exists at `./mock/mockClient` because the test harness and the
 * derived-view oracle compare against it. Nothing in `app/` imports it.
 */

import type { MEnsembleApi } from '@/types';
import { httpApi, setAuthToken as setHttpAuthToken } from './http';

export const api: MEnsembleApi = httpApi;

/** Set on login and on a cold start from storage, cleared on logout. */
export function setAuthToken(token: string | null): void {
  setHttpAuthToken(token);
}

export { ApiRequestError, isApiError, API_ERROR } from './errors';
