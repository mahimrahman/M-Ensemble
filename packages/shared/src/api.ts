/** Transport envelope + the client interface. Locked in PHASE 0. */

import type {
  AuthResult,
  CreatePostInput,
  DateString,
  ID,
  Iqamah,
  JummahSession,
  Membership,
  Mosque,
  NotificationPrefs,
  Post,
  PostType,
  PrayerTable,
  Signup,
  SignupInput,
  User,
} from './types';

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Error codes the UI branches on. Anything else is an unexpected failure. */
export const API_ERROR = {
  BAD_CREDENTIALS: 'BAD_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  NOT_FOUND: 'NOT_FOUND',
  FULL: 'FULL',
  ALREADY_SIGNED_UP: 'ALREADY_SIGNED_UP',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];

export interface FeedFilter {
  /** Empty/undefined means every type. */
  types?: PostType[];
  mosqueIds?: ID[];
}

export interface ServiceHours {
  totalMinutes: number;
  shiftsCompleted: number;
}

/** What one member is allowed to see about another. */
export type PublicUser = Pick<User, '_id' | 'name'>;

/** Type and mosque are fixed at creation; everything else an admin can change. */
export type UpdatePostInput = Partial<Omit<CreatePostInput, 'mosqueId' | 'type'>>;

export interface MosqueIqamahConfig {
  iqamah: Iqamah[];
  jummah: JummahSession[];
}

/** Whole-config replace. The mosque id comes from the route. */
export interface IqamahConfigInput {
  iqamah: Omit<Iqamah, 'mosqueId'>[];
  jummah: Omit<JummahSession, 'mosqueId'>[];
}

/**
 * The single surface every screen talks to.
 *
 * PHASE 1–3 this is fulfilled by the mock client; PHASE 5 by the HTTP client.
 * The signatures do not change between them — that is the whole point.
 */
export interface MEnsembleApi {
  login(email: string, password: string): Promise<AuthResult>;
  signupAccount(input: SignupInput): Promise<AuthResult>;
  me(): Promise<User>;
  updateMe(patch: Partial<Pick<User, 'name' | 'interests' | 'pushToken'>>): Promise<User>;
  /** Names for a list of ids — what a signup list renders. Never exposes email. */
  getUsers(ids: ID[]): Promise<PublicUser[]>;

  getMosques(): Promise<Mosque[]>;
  getMosque(id: ID): Promise<Mosque>;
  getFollowedMosques(): Promise<Mosque[]>;
  followMosque(mosqueId: ID): Promise<void>;
  unfollowMosque(mosqueId: ID): Promise<void>;

  getFeed(filter?: FeedFilter): Promise<Post[]>;
  getPost(id: ID): Promise<Post>;
  getMosquePosts(mosqueId: ID): Promise<Post[]>;
  createPost(input: CreatePostInput): Promise<Post>;

  // --- admin (requireAdmin(mosqueId) on the server) ---
  /** Every mosque this user holds a role at. Empty for a plain member. */
  getMyMemberships(): Promise<Membership[]>;
  /** Unlike `getMosquePosts`, includes past and cancelled posts. */
  getMosquePostsForAdmin(mosqueId: ID): Promise<Post[]>;
  updatePost(id: ID, patch: UpdatePostInput): Promise<Post>;
  cancelPost(id: ID): Promise<Post>;
  getIqamahConfig(mosqueId: ID): Promise<MosqueIqamahConfig>;
  setIqamahConfig(mosqueId: ID, input: IqamahConfigInput): Promise<MosqueIqamahConfig>;

  signup(postId: ID): Promise<Signup>;
  withdraw(postId: ID): Promise<void>;
  getSignups(postId: ID): Promise<Signup[]>;
  checkIn(postId: ID, userId: ID): Promise<void>;

  getCommitments(): Promise<Signup[]>;
  getServiceHours(): Promise<ServiceHours>;

  getPrayerTimes(mosqueId: ID, date: DateString): Promise<PrayerTable>;

  getNotificationPrefs(): Promise<NotificationPrefs>;
  updateNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs>;

  registerPushToken(token: string): Promise<void>;
}
