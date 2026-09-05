/**
 * The one door out of the UI.
 *
 * No screen calls `fetch`. No screen imports the mock client. No screen knows
 * which of the two it is talking to — that is what makes PHASE 5 a flag flip
 * instead of a rewrite.
 *
 *   PHASE 1–4: EXPO_PUBLIC_USE_MOCKS unset or "true"  → in-memory fixtures
 *   PHASE 5:   EXPO_PUBLIC_USE_MOCKS="false"          → real server
 */

import type { MEnsembleApi } from '@/types';
import { httpApi } from './http';
import { mockApi } from './mock/mockClient';

export const USING_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS !== 'false';

export const api: MEnsembleApi = USING_MOCKS ? mockApi : httpApi;

export { ApiRequestError, isApiError, API_ERROR } from './errors';
export { setAuthToken } from './http';
export { resetMockState } from './mock/mockClient';
