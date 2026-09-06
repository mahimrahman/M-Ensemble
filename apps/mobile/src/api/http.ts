/**
 * The transport. Every request the app makes goes through here.
 *
 * There is no other implementation any more - the mock client is gone, so if
 * this cannot reach the server, the app cannot do anything.
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
  ReliabilityRecord,
  RosterFilter,
  ServiceHours,
  Signup,
  SignupInput,
  UpdateMosqueInput,
  UpdatePostInput,
  User,
  WithdrawResult,
  ApiResponse,
} from '@/types';
import Constants from 'expo-constants';
import { ApiRequestError } from './errors';

/**
 * Where the API lives.
 *
 * `EXPO_PUBLIC_API_URL` wins when it is set. It is read from
 * `apps/mobile/.env`, which Expo only loads when it is started **from that
 * directory** - run `npx expo start` from the repo root and the variable is
 * silently absent. That failure is nasty: the app falls back to a URL, every
 * request fails, and because login is the first request the user is told their
 * password is wrong. It cost an afternoon once; hence the fallback below.
 *
 * With no variable set, derive the host from the dev server the bundle was
 * downloaded from. A phone that could reach Metro on 172.20.10.11:8081 can
 * reach the API on 172.20.10.11:4000, so this is right far more often than
 * `localhost` - which on a phone means the phone itself, and can never work.
 */
const API_PORT = 4000;

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  // `expo-constants` knows the host:port Metro is served from, in every form
  // Expo has used for it across SDKs.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)?.debuggerHost ??
    (Constants.manifest2 as { extra?: { expoGo?: { debuggerHost?: string } } } | undefined)?.extra
      ?.expoGo?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}/api`;

  // Web preview served from a browser: same host, API port.
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `http://${window.location.hostname}:${API_PORT}/api`;
  }

  return `http://localhost:${API_PORT}/api`;
}

const BASE_URL = resolveBaseUrl();

// Printed once at startup: when the app cannot reach the server, this line is
// the first thing worth checking.
console.log(`[api] ${BASE_URL}`);

let authToken: string | null = null;

/** Set on login, cleared on logout. PHASE 5 also persists it. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    // `fetch` rejects when the host is unreachable - wrong IP, server down,
    // phone on another network. Say that, rather than letting the login screen
    // render its default "email or password is incorrect": being told your
    // password is wrong when the server is simply absent sends people looking
    // in exactly the wrong place.
    throw new ApiRequestError(
      'NETWORK_ERROR',
      `Can't reach the server at ${BASE_URL}. Check it is running and that the phone is on the same network.`,
      0,
    );
  }

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
  updateMosque: (mosqueId: ID, body: UpdateMosqueInput) =>
    patch<Mosque>(`/mosques/${mosqueId}`, body),
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
  withdraw: (postId: ID) => del<WithdrawResult>(`/posts/${postId}/signup`),
  getSignups: (postId: ID) => get<Signup[]>(`/posts/${postId}/signups`),
  checkIn: (postId: ID, userId: ID) => post<void>(`/posts/${postId}/checkin`, { userId }),

  getCommitments: () => get<Signup[]>('/me/commitments'),
  getServiceHours: () => get<ServiceHours>('/me/hours'),
  getMyReliability: () => get<ReliabilityRecord>('/me/reliability'),

  getPrayerTimes: (mosqueId: ID, date: DateString) =>
    get<PrayerTable>(`/mosques/${mosqueId}/prayer-times?date=${date}`),

  getNotificationPrefs: () => get<NotificationPrefs>('/me/notification-prefs'),
  updateNotificationPrefs: (prefs: NotificationPrefs) =>
    put<NotificationPrefs>('/me/notification-prefs', prefs),

  registerPushToken: (token: string) => post<void>('/me/push-token', { token }),
};
