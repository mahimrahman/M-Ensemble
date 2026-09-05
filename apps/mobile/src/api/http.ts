/**
 * The real transport. Dormant until PHASE 5 — written now so that switching off
 * the mocks is a flag change, not a rewrite.
 *
 * Routes match the PHASE 4 plan. Some the plan doesn't list explicitly
 * (`/me/mosques`, `/me/memberships`, `/mosques/:id/posts[?all=true]`,
 * `/me/notification-prefs`, `/me/push-token`, `/users?ids=`, `GET /mosques/:id/iqamah`,
 * `POST /posts/:id/cancel`) — the server owner adds them or we adjust here.
 */

import type {
  AuthResult,
  CreatePostInput,
  DateString,
  EventOutcome,
  FeedFilter,
  ID,
  IqamahConfigInput,
  MEnsembleApi,
  MemberDetail,
  MemberRole,
  Membership,
  MosqueDashboard,
  MosqueIqamahConfig,
  MosqueMember,
  Mosque,
  NotificationPrefs,
  Post,
  PrayerTable,
  PublicUser,
  RosterEntry,
  RosterFilter,
  ServiceHours,
  Signup,
  SignupInput,
  UpdatePostInput,
  User,
  ApiResponse,
} from '@/types';
import { ApiRequestError } from './errors';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

let authToken: string | null = null;

/** Set on login, cleared on logout. PHASE 5 also persists it. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.ok) {
    throw new ApiRequestError(body.error.code, body.error.message, res.status);
  }

  return body.data;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
const patch = <T>(path: string, data: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });
const put = <T>(path: string, data: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(data) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

function rosterQuery(filter?: RosterFilter): string {
  const params = new URLSearchParams();
  if (filter?.upcoming) params.set('upcoming', 'true');
  if (filter?.types?.length) params.set('types', filter.types.join(','));
  if (filter?.postId) params.set('post', filter.postId);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function feedQuery(filter?: FeedFilter): string {
  const params = new URLSearchParams();
  if (filter?.types?.length) params.set('types', filter.types.join(','));
  if (filter?.mosqueIds?.length) params.set('mosques', filter.mosqueIds.join(','));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const httpApi: MEnsembleApi = {
  login: (email: string, password: string) =>
    post<AuthResult>('/auth/login', { email, password }).then((result) => {
      setAuthToken(result.token);
      return result;
    }),

  signupAccount: (input: SignupInput) =>
    post<AuthResult>('/auth/signup', input).then((result) => {
      setAuthToken(result.token);
      return result;
    }),

  me: () => get<User>('/me'),
  updateMe: (body) => patch<User>('/me', body),
  getUsers: (ids: ID[]) => get<PublicUser[]>(`/users?ids=${ids.join(',')}`),

  getMosques: () => get<Mosque[]>('/mosques'),
  getMosque: (id: ID) => get<Mosque>(`/mosques/${id}`),
  getFollowedMosques: () => get<Mosque[]>('/me/mosques'),
  followMosque: (mosqueId: ID) => post<void>(`/mosques/${mosqueId}/follow`),
  unfollowMosque: (mosqueId: ID) => del<void>(`/mosques/${mosqueId}/follow`),

  getFeed: (filter?: FeedFilter) => get<Post[]>(`/feed${feedQuery(filter)}`),
  getPost: (id: ID) => get<Post>(`/posts/${id}`),
  getMosquePosts: (mosqueId: ID) => get<Post[]>(`/mosques/${mosqueId}/posts`),
  createPost: (input: CreatePostInput) => post<Post>('/posts', input),

  getMyMemberships: () => get<Membership[]>('/me/memberships'),
  getMosquePostsForAdmin: (mosqueId: ID) => get<Post[]>(`/mosques/${mosqueId}/posts?all=true`),
  updatePost: (id: ID, body: UpdatePostInput) => patch<Post>(`/posts/${id}`, body),
  cancelPost: (id: ID) => post<Post>(`/posts/${id}/cancel`),
  getIqamahConfig: (mosqueId: ID) => get<MosqueIqamahConfig>(`/mosques/${mosqueId}/iqamah`),
  setIqamahConfig: (mosqueId: ID, input: IqamahConfigInput) =>
    put<MosqueIqamahConfig>(`/mosques/${mosqueId}/iqamah`, input),

  getMosqueDashboard: (mosqueId: ID) => get<MosqueDashboard>(`/mosques/${mosqueId}/dashboard`),
  getMosqueRoster: (mosqueId: ID, filter?: RosterFilter) =>
    get<RosterEntry[]>(`/mosques/${mosqueId}/roster${rosterQuery(filter)}`),
  getMosqueMembers: (mosqueId: ID) => get<MosqueMember[]>(`/mosques/${mosqueId}/members`),
  getMemberDetail: (mosqueId: ID, userId: ID) =>
    get<MemberDetail>(`/mosques/${mosqueId}/members/${userId}`),
  setMemberRole: (mosqueId: ID, userId: ID, role: MemberRole) =>
    put<MosqueMember>(`/mosques/${mosqueId}/members/${userId}/role`, { role }),
  getEventOutcomes: (mosqueId: ID) => get<EventOutcome[]>(`/mosques/${mosqueId}/outcomes`),

  signup: (postId: ID) => post<Signup>(`/posts/${postId}/signup`),
  withdraw: (postId: ID) => del<void>(`/posts/${postId}/signup`),
  getSignups: (postId: ID) => get<Signup[]>(`/posts/${postId}/signups`),
  checkIn: (postId: ID, userId: ID) => post<void>(`/posts/${postId}/checkin`, { userId }),

  getCommitments: () => get<Signup[]>('/me/commitments'),
  getServiceHours: () => get<ServiceHours>('/me/hours'),

  getPrayerTimes: (mosqueId: ID, date: DateString) =>
    get<PrayerTable>(`/mosques/${mosqueId}/prayer-times?date=${date}`),

  getNotificationPrefs: () => get<NotificationPrefs>('/me/notification-prefs'),
  updateNotificationPrefs: (prefs: NotificationPrefs) =>
    put<NotificationPrefs>('/me/notification-prefs', prefs),

  registerPushToken: (token: string) => post<void>('/me/push-token', { token }),
};
