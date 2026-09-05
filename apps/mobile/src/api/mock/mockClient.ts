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
  type EventOutcome,
  type FeedFilter,
  type Follow,
  type ID,
  type Iqamah,
  type JummahSession,
  type MEnsembleApi,
  type MemberDetail,
  type MemberRole,
  type Membership,
  type Mosque,
  type MosqueDashboard,
  type MosqueMember,
  type NotificationPrefs,
  type Post,
  type PublicUser,
  type RosterEntry,
  type RosterFilter,
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
} from '@m-ensemble/shared';

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

const TOKEN_PREFIX = 'mock-token-';

/**
 * The mock's answer to a bearer token. `login` hands out `mock-token-<userId>`;
 * on a cold start the auth store hands the stored one back here so the mock
 * knows who is signed in — otherwise a reload silently turned every session
 * into the default member, and coordinators lost their dashboard.
 *
 * A token for a user the fixtures don't know (an account created in a
 * previous session — the state is in-memory) resolves to nobody, so `me()`
 * throws 401 and the auth store signs out, same as an expired JWT would.
 */
export function restoreMockSession(token: string | null): void {
  const id = token?.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null;
  state.currentUserId = id && state.users.some((u) => u._id === id) ? id : null;
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minutes a post runs for — what one attended shift is worth. */
function postMinutes(post: Post): number {
  const mins = (new Date(post.endAt).getTime() - new Date(post.startAt).getTime()) / 60000;
  return Math.max(0, Math.round(mins));
}

/** Flattens a signup against its post, the shape every admin list renders. */
function toRosterEntry(signup: Signup, post: Post, name: string): RosterEntry {
  return {
    signup: clone(signup),
    postId: post._id,
    postTitle: post.title,
    postType: post.type,
    startAt: post.startAt,
    endAt: post.endAt,
    userId: signup.userId,
    userName: name,
  };
}

/**
 * The mosque's people: everyone who follows it plus everyone holding a role,
 * scored by what they have actually turned up to. A role without a follow
 * still counts — a coordinator need not follow the mosque they run.
 */
function buildMembers(mosqueId: ID): MosqueMember[] {
  const postIds = new Set(state.posts.filter((p) => p.mosqueId === mosqueId).map((p) => p._id));
  const postById = new Map(state.posts.map((p) => [p._id, p]));

  const joinedAt = new Map<ID, string>();
  for (const follow of state.follows) {
    if (follow.mosqueId === mosqueId) joinedAt.set(follow.userId, follow.createdAt);
  }
  const roleOf = new Map<ID, MemberRole>();
  for (const m of state.memberships) {
    if (m.mosqueId !== mosqueId) continue;
    roleOf.set(m.userId, m.role);
    const seen = joinedAt.get(m.userId);
    if (!seen || new Date(m.createdAt) < new Date(seen)) joinedAt.set(m.userId, m.createdAt);
  }

  // Anyone who ever signed up here belongs in the directory too, follow or not.
  for (const signup of state.signups) {
    if (!postIds.has(signup.postId) || joinedAt.has(signup.userId)) continue;
    joinedAt.set(signup.userId, signup.createdAt ?? new Date().toISOString());
  }

  const members: MosqueMember[] = [];
  for (const [userId, joined] of joinedAt) {
    const user = state.users.find((u) => u._id === userId);
    if (!user) continue;

    const mine = state.signups.filter(
      (s) => s.userId === userId && postIds.has(s.postId) && s.status === 'confirmed',
    );
    const attended = mine.filter((s) => s.checkedInAt);
    const minutesServed = attended.reduce((sum, s) => {
      const post = postById.get(s.postId);
      return post && post.type === 'volunteer' ? sum + postMinutes(post) : sum;
    }, 0);
    const lastSeenAt = attended
      .map((s) => s.checkedInAt as string)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    members.push({
      userId,
      name: user.name,
      role: roleOf.get(userId) ?? 'member',
      joinedAt: joined,
      signupCount: mine.length,
      attendedCount: attended.length,
      minutesServed,
      ...(lastSeenAt ? { lastSeenAt } : {}),
      interests: [...user.interests],
    });
  }

  // Coordinators first, then whoever shows up most.
  return members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return b.attendedCount - a.attendedCount || a.name.localeCompare(b.name);
  });
}

// ----------------------------------------------------------------- client ---

export const mockApi: MEnsembleApi = {
  async login(email, password) {
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== MOCK_PASSWORD) {
      throw new ApiRequestError(API_ERROR.BAD_CREDENTIALS, 'Email or password is incorrect.', 401);
    }
    state.currentUserId = user._id;
    return delay<AuthResult>({ token: `${TOKEN_PREFIX}${user._id}`, user: clone(user) });
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
    return delay<AuthResult>({ token: `${TOKEN_PREFIX}${user._id}`, user: clone(user) });
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

  async getMosqueDashboard(mosqueId) {
    requireAdmin(mosqueId);
    const now = Date.now();
    const posts = state.posts.filter((p) => p.mosqueId === mosqueId);
    const live = posts.filter((p) => isLive(p, now));
    const ended = posts.filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() < now);
    const liveIds = new Set(live.map((p) => p._id));
    const endedIds = new Set(ended.map((p) => p._id));

    const volunteer = live.filter((p) => p.type === 'volunteer' && p.slotsNeeded !== undefined);
    const slotsNeeded = volunteer.reduce((sum, p) => sum + (p.slotsNeeded ?? 0), 0);
    const slotsUnfilled = volunteer.reduce(
      (sum, p) => sum + Math.max(0, (p.slotsNeeded ?? 0) - p.slotsFilled),
      0,
    );

    const confirmedLive = state.signups.filter(
      (s) => liveIds.has(s.postId) && s.status === 'confirmed',
    );
    const newSignups24h = confirmedLive.filter(
      (s) => s.createdAt && now - new Date(s.createdAt).getTime() < DAY_MS,
    ).length;

    const confirmedEnded = state.signups.filter(
      (s) => endedIds.has(s.postId) && s.status === 'confirmed',
    );
    const attendedEnded = confirmedEnded.filter((s) => s.checkedInAt);
    const attendanceRate = confirmedEnded.length
      ? Math.round((attendedEnded.length / confirmedEnded.length) * 100)
      : 0;

    const postById = new Map(posts.map((p) => [p._id, p]));
    const minutesServed = attendedEnded.reduce((sum, s) => {
      const post = postById.get(s.postId);
      return post && post.type === 'volunteer' ? sum + postMinutes(post) : sum;
    }, 0);

    const cutoff = now + 7 * DAY_MS;

    return delay<MosqueDashboard>({
      mosqueId,
      upcomingCount: live.filter((p) => new Date(p.startAt).getTime() <= cutoff).length,
      slotsUnfilled,
      slotsNeeded,
      newSignups24h,
      activePeople: new Set(confirmedLive.map((s) => s.userId)).size,
      followerCount: state.follows.filter((f) => f.mosqueId === mosqueId).length,
      attendanceRate,
      minutesServed,
    });
  },

  async getMosqueRoster(mosqueId, filter?: RosterFilter) {
    requireAdmin(mosqueId);
    const now = Date.now();
    const posts = state.posts.filter((p) => {
      if (p.mosqueId !== mosqueId || p.cancelledAt) return false;
      if (filter?.postId && p._id !== filter.postId) return false;
      if (filter?.types?.length && !filter.types.includes(p.type)) return false;
      if (filter?.upcoming && new Date(p.endAt).getTime() < now) return false;
      return true;
    });
    const postById = new Map(posts.map((p) => [p._id, p]));

    const entries = state.signups
      .filter((s) => postById.has(s.postId) && s.status === 'confirmed')
      .map((s) => {
        const post = postById.get(s.postId) as Post;
        const user = state.users.find((u) => u._id === s.userId);
        return toRosterEntry(s, post, user?.name ?? '—');
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    return delay(entries);
  },

  async getMosqueMembers(mosqueId) {
    requireAdmin(mosqueId);
    return delay(buildMembers(mosqueId));
  },

  async getMemberDetail(mosqueId, userId) {
    requireAdmin(mosqueId);
    const member = buildMembers(mosqueId).find((m) => m.userId === userId);
    if (!member) {
      throw new ApiRequestError(API_ERROR.NOT_FOUND, 'Nobody here by that id.', 404);
    }
    const postById = new Map(
      state.posts.filter((p) => p.mosqueId === mosqueId).map((p) => [p._id, p]),
    );
    const history = state.signups
      .filter((s) => s.userId === userId && postById.has(s.postId) && s.status === 'confirmed')
      .map((s) => toRosterEntry(s, postById.get(s.postId) as Post, member.name))
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    return delay<MemberDetail>({ member, history });
  },

  async setMemberRole(mosqueId, userId, role) {
    const actor = requireAdmin(mosqueId);
    // Losing your own role would lock you out of the screen you are standing on.
    if (actor._id === userId && role !== 'admin') {
      throw new ApiRequestError(
        API_ERROR.FORBIDDEN,
        'You cannot remove your own coordinator role.',
        403,
      );
    }
    const existing = state.memberships.find((m) => m.mosqueId === mosqueId && m.userId === userId);
    if (existing) {
      existing.role = role;
    } else {
      state.memberships.push({
        _id: makeId('member'),
        userId,
        mosqueId,
        role,
        createdAt: new Date().toISOString(),
      });
    }
    const member = buildMembers(mosqueId).find((m) => m.userId === userId);
    if (!member) {
      throw new ApiRequestError(API_ERROR.NOT_FOUND, 'Nobody here by that id.', 404);
    }
    return delay(member);
  },

  async getEventOutcomes(mosqueId) {
    requireAdmin(mosqueId);
    const now = Date.now();
    const ended = state.posts.filter(
      (p) =>
        p.mosqueId === mosqueId &&
        !p.cancelledAt &&
        p.type !== 'announcement' &&
        new Date(p.endAt).getTime() < now,
    );

    const outcomes = ended
      .map<EventOutcome>((post) => {
        const confirmed = state.signups.filter(
          (s) => s.postId === post._id && s.status === 'confirmed',
        );
        return {
          postId: post._id,
          title: post.title,
          type: post.type,
          startAt: post.startAt,
          endAt: post.endAt,
          confirmed: confirmed.length,
          attended: confirmed.filter((s) => s.checkedInAt).length,
          target: post.slotsNeeded ?? post.capacity ?? null,
        };
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    return delay(outcomes);
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
