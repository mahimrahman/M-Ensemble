/**
 * The transport. Every request the app makes goes through here.
 *
 * There is no other implementation any more - the mock client is gone, so if
 * this cannot reach the server, the app cannot do anything.
 */

import type {
  AuthResult,
  BroadcastInput,
  BroadcastResult,
  CreatePostInput,
  DateString,
  EventOutcome,
  FeedFilter,
  ID,
  IqamahConfigInput,
  LikeResult,
  MEnsembleApi,
  MemberDetail,
  MemberRole,
  Membership,
  MosqueDashboard,
  MosqueIqamahConfig,
  MosqueMember,
  Mosque,
  NotificationFeed,
  NotificationPrefs,
  PosterUpload,
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
  UploadedPoster,
  User,
  WithdrawResult,
  ApiResponse,
} from '@/types';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { ApiRequestError } from './errors';

/**
 * Where the API lives.
 *
 * **Derived by default, pinned only on purpose.**
 *
 * The dev server the bundle was downloaded from is the one piece of routing
 * the phone has already proved: it got the JavaScript. A device that reached
 * Metro on 172.20.10.11:8081 can reach the API on 172.20.10.11:4000, so the
 * host is taken from there and follows the machine onto a new network - a
 * hotspot, a different office - without anyone editing a file.
 *
 * `EXPO_PUBLIC_API_URL` still overrides it, for a server that genuinely lives
 * elsewhere. It used to hold a LAN IP for everyday development, and that is a
 * trap worth spelling out: the address outlives the network that made it
 * valid, and a stale one does not fail cleanly. Off-subnet, nothing answers
 * and nothing refuses, so every request hung until `TIMEOUT_MS` existed to
 * stop it - which is how a one-line `.env` left every screen in the app
 * spinning at once.
 *
 * Note also that Expo loads `apps/mobile/.env` only when started **from that
 * directory**; `npx expo start` at the repo root drops the variable silently.
 * One more reason the derived host, not the file, is the path that has to work.
 */
const API_PORT = 4000;

function resolveBaseUrl(): string {
  // An empty or blank value means "not set" - a commented-out line and a
  // leftover `EXPO_PUBLIC_API_URL=` should behave the same way.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
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

/**
 * How long a single request may take before the app gives up on it.
 *
 * `fetch` has no timeout of its own, on React Native or anywhere else, and a
 * host that is merely *unroutable* never answers at all: the phone gets no
 * connection refused, no DNS failure, nothing to reject on. It simply waits.
 *
 * That is how a wrong `EXPO_PUBLIC_API_URL` used to take down every screen at
 * once. `useApi` starts at `loading: true` and only leaves it in the
 * `finally` of the request, so a promise that never settles is a spinner that
 * never stops - on every screen, forever, with no error anywhere to explain
 * it. `ErrorState` could not help, because nothing ever threw.
 *
 * Ten seconds is far longer than this API needs on a bad mobile connection and
 * far shorter than a reader will sit in front of a spinner.
 */
const TIMEOUT_MS = 10_000;

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch (err) {
    // Two different failures arrive here and they send you looking in
    // different places, so they say different things:
    //
    //   aborted  - the host neither accepted nor refused. Almost always the
    //              wrong address: an IP left over from the last network, or a
    //              phone that has dropped off this one.
    //   rejected - the host answered "no". The server is down or the port is
    //              closed; the address itself is probably right.
    const timedOut = (err as { name?: string } | undefined)?.name === 'AbortError';
    // Neither may reach the login screen as its default "email or password is
    // incorrect" - being told your password is wrong when the server is simply
    // absent sends people looking in exactly the wrong place.
    throw new ApiRequestError(
      'NETWORK_ERROR',
      timedOut
        ? `No answer from ${BASE_URL} after ${TIMEOUT_MS / 1000}s. Check the phone is on the same network as the server.`
        : `Can't reach the server at ${BASE_URL}. Check it is running and that the phone is on the same network.`,
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  // A reachable host is not necessarily this server. A captive portal, a
  // proxy, or Metro itself on the wrong port all answer with HTML, and
  // `res.json()` then throws a bare SyntaxError that no screen knows to catch.
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiRequestError(
      'NETWORK_ERROR',
      `${BASE_URL} answered with something that isn't this API (HTTP ${res.status}).`,
      res.status,
    );
  }

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

/**
 * Turns a stored media path into something an <Image> can load.
 *
 * The server hands back and stores `/uploads/<id>.jpg` rather than a full
 * URL, because this API answers on a different address from every machine
 * that talks to it — localhost on the dev box, a LAN IP from a phone, 4100
 * under test. An absolute URL in the database is correct exactly once and
 * wrong from everywhere else, and it breaks the moment the laptop changes
 * network, which is the same trap `resolveBaseUrl` exists to avoid.
 *
 * So the path is resolved here, against whichever base the app is already
 * successfully using. `BASE_URL` ends in `/api` and the static mount does
 * not, hence trimming it. Anything already absolute is passed through — the
 * fixtures' posters are bundled, not fetched, but a future CDN URL would
 * arrive that way and must not be mangled.
 */
export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${BASE_URL.replace(/\/api$/, '')}${url}`;
}

/**
 * The one multipart request in the app.
 *
 * It cannot go through `request`, for two reasons that both bite silently:
 *
 * - `request` sets `Content-Type: application/json` on everything. Multipart
 *   needs a `boundary` parameter that only the runtime can generate, so the
 *   header has to be left off entirely and `fetch` filled it in — setting it
 *   by hand produces a body the server cannot parse.
 * - The 10-second timeout is sized for JSON. A poster on a slow connection
 *   legitimately takes longer, and aborting mid-upload would report itself as
 *   "can't reach the server" for a server that is answering fine.
 *
 * React Native's `FormData` takes `{ uri, name, type }` for a file part and
 * reads the file itself; on web the same shape is not understood, so the blob
 * is fetched first and appended as a real `Blob`. One `Platform.OS` check
 * rather than two code paths through everything above it.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

async function postPoster(mosqueId: string, file: PosterUpload): Promise<UploadedPoster> {
  const body = new FormData();
  body.append('mosqueId', mosqueId);

  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    body.append('image', blob, file.name);
  } else {
    body.append('image', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    } as unknown as Blob);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/uploads/poster`, {
      method: 'POST',
      body,
      signal: controller.signal,
      // No Content-Type: `fetch` writes it, with the boundary.
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR', `Couldn't send the image to ${BASE_URL}.`, 0);
  } finally {
    clearTimeout(timer);
  }

  let payload: ApiResponse<UploadedPoster>;
  try {
    payload = (await res.json()) as ApiResponse<UploadedPoster>;
  } catch {
    throw new ApiRequestError(
      'NETWORK_ERROR',
      `The server rejected the image without saying why (HTTP ${res.status}).`,
      res.status,
    );
  }

  if (!payload.ok) {
    throw new ApiRequestError(payload.error.code, payload.error.message, res.status);
  }
  return payload.data;
}

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
  uploadPoster: (mosqueId: ID, file: PosterUpload) => postPoster(mosqueId, file),

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

  likePost: (postId: ID) => post<LikeResult>(`/posts/${postId}/like`),
  unlikePost: (postId: ID) => del<LikeResult>(`/posts/${postId}/like`),
  getMyLikes: () => get<ID[]>('/me/likes'),

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

  getNotifications: () => get<NotificationFeed>('/me/notifications'),
  markNotificationsRead: () => post<NotificationFeed>('/me/notifications/read'),
  broadcast: (mosqueId: ID, input: BroadcastInput) =>
    post<BroadcastResult>(`/mosques/${mosqueId}/notifications`, input),

  registerPushToken: (token: string) => post<void>('/me/push-token', { token }),
};
