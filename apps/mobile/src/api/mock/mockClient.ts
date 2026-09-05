/**
 * In-memory implementation of `MEnsembleApi`.
 *
 * It fulfils exactly the same interface the HTTP client will, including the
 * error codes — a screen written against this one needs no changes in PHASE 5.
 * State lives for the lifetime of the JS bundle: reload the app to reset.
 */

import {
  API_ERROR,
  type AuthResult,
  type CreatePostInput,
  type FeedFilter,
  type Follow,
  type ID,
  type Iqamah,
  type JummahSession,
  type MEnsembleApi,
  type Membership,
  type Mosque,
  type NotificationPrefs,
  type Post,
  type PublicUser,
  type ServiceHours,
  type Signup,
  type SignupInput,
  type User,
} from '@/types';
import { ApiRequestError } from '../errors';
import { buildPrayerTable } from '@/lib/prayer';
import {
  CURRENT_USER_ID,
  MOCK_PASSWORD,
  defaultNotificationPrefs,
  mockFollows,
  mockIqamah,
  mockJummah,
  mockMemberships,
  mockMosques,
  mockPastPosts,
  mockPosts,
  mockSignups,
  mockUsers,
} from './mockData';

/** Enough delay that spinners and disabled states actually get exercised. */
const LATENCY_MS = 320;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

let nextId = 1000;
function makeId(prefix: string): string {
  nextId += 1;
  return `${prefix}_${nextId}`;
}

// ------------------------------------------------------------------ state ---

interface MockState {
  users: User[];
  mosques: Mosque[];
  posts: Post[];
  signups: Signup[];
  follows: Follow[];
  memberships: Membership[];
  iqamah: Iqamah[];
  jummah: JummahSession[];
  prefs: NotificationPrefs;
  currentUserId: ID | null;
}

function fresh(): MockState {
  return {
    users: clone(mockUsers),
    mosques: clone(mockMosques),
    posts: [...clone(mockPosts), ...clone(mockPastPosts)],
    signups: clone(mockSignups),
    follows: clone(mockFollows),
    memberships: clone(mockMemberships),
    iqamah: clone(mockIqamah),
    jummah: clone(mockJummah),
    prefs: clone(defaultNotificationPrefs),
    // Signed in by default so the app is walkable before auth screens exist.
    currentUserId: CURRENT_USER_ID,
  };
}

let state: MockState = fresh();

/** Wipe back to the fixtures — handy from a dev menu during rehearsal. */
export function resetMockState(): void {
  state = fresh();
}

function requireUser(): User {
  const user = state.users.find((u) => u._id === state.currentUserId);
  if (!user) {
    throw new ApiRequestError(API_ERROR.FORBIDDEN, 'Not signed in.', 401);
  }
  return user;
}

function requirePost(id: ID): Post {
  const post = state.posts.find((p) => p._id === id);
  if (!post) {
    throw new ApiRequestError(API_ERROR.NOT_FOUND, 'That post no longer exists.', 404);
  }
  return post;
}

function requireMosque(id: ID): Mosque {
  const mosque = state.mosques.find((m) => m._id === id);
  if (!mosque) {
    throw new ApiRequestError(API_ERROR.NOT_FOUND, 'Mosque not found.', 404);
  }
  return mosque;
}

/** The server's `requireAdmin(mosqueId)`: a Membership with role admin. */
function requireAdmin(mosqueId: ID): User {
  const user = requireUser();
  const isAdmin = state.memberships.some(
    (m) => m.userId === user._id && m.mosqueId === mosqueId && m.role === 'admin',
  );
  if (!isAdmin) {
    throw new ApiRequestError(
      API_ERROR.FORBIDDEN,
      'Only a coordinator of this mosque can do that.',
      403,
    );
  }
  return user;
}

function isLive(post: Post, now: number): boolean {
  return !post.cancelledAt && new Date(post.endAt).getTime() >= now;
}

const byStart = (a: Post, b: Post) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime();

// ----------------------------------------------------------------- client ---

export const mockApi: MEnsembleApi = {
  async login(email, password) {
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== MOCK_PASSWORD) {
      throw new ApiRequestError(API_ERROR.BAD_CREDENTIALS, 'Email or password is incorrect.', 401);
    }
    state.currentUserId = user._id;
    return delay<AuthResult>({ token: `mock-token-${user._id}`, user: clone(user) });
  },

  async signupAccount(input: SignupInput) {
    const exists = state.users.some(
      (u) => u.email.toLowerCase() === input.email.trim().toLowerCase(),
    );
    if (exists) {
      throw new ApiRequestError(API_ERROR.EMAIL_TAKEN, 'That email already has an account.', 409);
    }
    const user: User = {
      _id: makeId('user'),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      interests: [],
    };
    state.users.push(user);
    state.currentUserId = user._id;
    return delay<AuthResult>({ token: `mock-token-${user._id}`, user: clone(user) });
  },

  async me() {
    return delay(clone(requireUser()));
  },

  async updateMe(patch) {
    const user = requireUser();
    Object.assign(user, patch);
    return delay(clone(user));
  },

  async getUsers(ids) {
    const found = state.users
      .filter((u) => ids.includes(u._id))
      .map<PublicUser>((u) => ({ _id: u._id, name: u.name }));
    return delay(found);
  },

  async getMosques() {
    return delay(clone(state.mosques));
  },

  async getMosque(id) {
    return delay(clone(requireMosque(id)));
  },

  async getFollowedMosques() {
    const user = requireUser();
    const ids = state.follows.filter((f) => f.userId === user._id).map((f) => f.mosqueId);
    return delay(clone(state.mosques.filter((m) => ids.includes(m._id))));
  },

  async followMosque(mosqueId) {
    const user = requireUser();
    const already = state.follows.some((f) => f.userId === user._id && f.mosqueId === mosqueId);
    if (!already) {
      state.follows.push({
        _id: makeId('follow'),
        userId: user._id,
        mosqueId,
        createdAt: new Date().toISOString(),
      });
    }
    return delay(undefined);
  },

  async unfollowMosque(mosqueId) {
    const user = requireUser();
    state.follows = state.follows.filter(
      (f) => !(f.userId === user._id && f.mosqueId === mosqueId),
    );
    return delay(undefined);
  },

  async getFeed(filter?: FeedFilter) {
    const user = requireUser();
    const followed = state.follows.filter((f) => f.userId === user._id).map((f) => f.mosqueId);
    const scope = filter?.mosqueIds?.length ? filter.mosqueIds : followed;
    const now = Date.now();

    const posts = state.posts
      .filter((p) => scope.includes(p.mosqueId))
      .filter((p) => !filter?.types?.length || filter.types.includes(p.type))
      .filter((p) => isLive(p, now))
      .sort(byStart);

    return delay(clone(posts));
  },

  async getPost(id) {
    return delay(clone(requirePost(id)));
  },

  async getMosquePosts(mosqueId) {
    const now = Date.now();
    const posts = state.posts
      .filter((p) => p.mosqueId === mosqueId && isLive(p, now))
      .sort(byStart);
    return delay(clone(posts));
  },

  async createPost(input: CreatePostInput) {
    const user = requireAdmin(input.mosqueId);
    const post: Post = {
      ...input,
      _id: makeId('post'),
      slotsFilled: 0,
      createdBy: user._id,
      createdAt: new Date().toISOString(),
    };
    state.posts.push(post);
    // PHASE 4 fans a push out to followers whose interests include
    // `input.category` right here.
    return delay(clone(post));
  },

  // ---------------------------------------------------------------- admin ---

  async getMyMemberships() {
    const user = requireUser();
    return delay(clone(state.memberships.filter((m) => m.userId === user._id)));
  },

  async getMosquePostsForAdmin(mosqueId) {
    requireAdmin(mosqueId);
    return delay(clone(state.posts.filter((p) => p.mosqueId === mosqueId).sort(byStart)));
  },

  async updatePost(id, patch) {
    const post = requirePost(id);
    requireAdmin(post.mosqueId);
    Object.assign(post, patch);
    return delay(clone(post));
  },

  async cancelPost(id) {
    const post = requirePost(id);
    requireAdmin(post.mosqueId);
    post.cancelledAt = post.cancelledAt ?? new Date().toISOString();
    return delay(clone(post));
  },

  async getIqamahConfig(mosqueId) {
    requireMosque(mosqueId);
    return delay({
      iqamah: clone(state.iqamah.filter((i) => i.mosqueId === mosqueId)),
      jummah: clone(state.jummah.filter((j) => j.mosqueId === mosqueId)),
    });
  },

  async setIqamahConfig(mosqueId, input) {
    requireAdmin(mosqueId);
    state.iqamah = [
      ...state.iqamah.filter((i) => i.mosqueId !== mosqueId),
      ...input.iqamah.map((i) => ({ ...i, mosqueId })),
    ];
    state.jummah = [
      ...state.jummah.filter((j) => j.mosqueId !== mosqueId),
      ...input.jummah.map((j) => ({ ...j, mosqueId })),
    ];
    return delay({
      iqamah: clone(state.iqamah.filter((i) => i.mosqueId === mosqueId)),
      jummah: clone(state.jummah.filter((j) => j.mosqueId === mosqueId)),
    });
  },

  // -------------------------------------------------------------- signups ---

  async signup(postId) {
    const user = requireUser();
    const post = requirePost(postId);

    if (post.cancelledAt) {
      throw new ApiRequestError(API_ERROR.NOT_FOUND, 'This post was cancelled.', 410);
    }

    const existing = state.signups.find((s) => s.postId === postId && s.userId === user._id);
    if (existing?.status === 'confirmed') {
      throw new ApiRequestError(API_ERROR.ALREADY_SIGNED_UP, "You're already signed up.", 409);
    }

    // Mirrors the server's atomic guard: the count is checked and incremented
    // together, never read first and written later.
    const limit = post.slotsNeeded ?? post.capacity;
    if (limit !== undefined && post.slotsFilled >= limit) {
      throw new ApiRequestError(API_ERROR.FULL, 'That filled up while you were looking.', 409);
    }
    post.slotsFilled += 1;

    if (existing) {
      existing.status = 'confirmed';
      existing.createdAt = new Date().toISOString();
      delete existing.checkedInAt;
      return delay(clone(existing));
    }

    const signup: Signup = {
      _id: makeId('signup'),
      postId,
      userId: user._id,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };
    state.signups.push(signup);
    return delay(clone(signup));
  },

  async withdraw(postId) {
    const user = requireUser();
    const post = requirePost(postId);
    const signup = state.signups.find(
      (s) => s.postId === postId && s.userId === user._id && s.status === 'confirmed',
    );
    if (!signup) {
      throw new ApiRequestError(API_ERROR.NOT_FOUND, "You aren't signed up for this.", 404);
    }
    signup.status = 'withdrawn';
    delete signup.checkedInAt;
    post.slotsFilled = Math.max(0, post.slotsFilled - 1);
    return delay(undefined);
  },

  async getSignups(postId) {
    requirePost(postId);
    return delay(clone(state.signups.filter((s) => s.postId === postId)));
  },

  async checkIn(postId, userId) {
    const post = requirePost(postId);
    const actor = requireUser();
    // A member may check themselves in (the QR flow); anyone else needs the role.
    if (actor._id !== userId) requireAdmin(post.mosqueId);

    const signup = state.signups.find(
      (s) => s.postId === postId && s.userId === userId && s.status === 'confirmed',
    );
    if (!signup) {
      throw new ApiRequestError(API_ERROR.NOT_FOUND, 'No confirmed signup to check in.', 404);
    }
    signup.checkedInAt = signup.checkedInAt ?? new Date().toISOString();
    return delay(undefined);
  },

  async getCommitments() {
    const user = requireUser();
    const mine = state.signups.filter((s) => s.userId === user._id && s.status === 'confirmed');
    return delay(clone(mine));
  },

  async getServiceHours() {
    const user = requireUser();
    const served = state.signups.filter((s) => s.userId === user._id && s.checkedInAt);

    const totalMinutes = served.reduce((sum, signup) => {
      const post = state.posts.find((p) => p._id === signup.postId);
      if (!post) return sum;
      const mins = (new Date(post.endAt).getTime() - new Date(post.startAt).getTime()) / 60000;
      return sum + Math.max(0, Math.round(mins));
    }, 0);

    return delay<ServiceHours>({ totalMinutes, shiftsCompleted: served.length });
  },

  // --------------------------------------------------------------- prayer ---

  async getPrayerTimes(mosqueId, date) {
    const mosque = requireMosque(mosqueId);
    return delay(buildPrayerTable(mosque, date, state.iqamah, state.jummah));
  },

  // ---------------------------------------------------------------- prefs ---

  async getNotificationPrefs() {
    return delay(clone(state.prefs));
  },

  async updateNotificationPrefs(prefs) {
    state.prefs = clone(prefs);
    return delay(clone(state.prefs));
  },

  async registerPushToken(token) {
    const user = requireUser();
    user.pushToken = token;
    return delay(undefined);
  },
};
