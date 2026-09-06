/**
 * In-memory implementation of `MEnsembleApi`.
 *
 * It fulfils exactly the same interface the HTTP client will, including the
 * error codes — a screen written against this one needs no changes in PHASE 5.
 * State lives for the lifetime of the JS bundle: reload the app to reset.
 */

import {
  API_ERROR,
  SOCIAL_PLATFORMS,
  normalizeSocial,
  type AppNotification,
  type AuthResult,
  type BroadcastInput,
  type CreatePostInput,
  type EventOutcome,
  type FeedFilter,
  type Follow,
  type ID,
  type Iqamah,
  type JummahSession,
  type Like,
  type LikeResult,
  type MEnsembleApi,
  type MemberDetail,
  type MemberRole,
  type Membership,
  type Mosque,
  type MosqueDashboard,
  type MosqueMember,
  type MosqueSocial,
  type NotificationFeed,
  type NotificationPrefs,
  type Post,
  type PublicUser,
  type ReliabilityIncident,
  type ReliabilityRecord,
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
  LATE_CANCEL_HOURS,
  coordinatorMosqueFor,
  defaultNotificationPrefs,
  mockFollows,
  mockIqamah,
  mockJummah,
  likeCountFor,
  mockLikes,
  mockMemberships,
  allMosques,
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
  likes: Like[];
  memberships: Membership[];
  iqamah: Iqamah[];
  jummah: JummahSession[];
  prefs: NotificationPrefs;
  /** One row per recipient, exactly as the server stores them. */
  notifications: AppNotification[];
  currentUserId: ID | null;
}

function fresh(): MockState {
  return {
    users: clone(mockUsers),
    mosques: clone(allMosques),
    // `likeCount` is derived here for the same reason the seed derives it:
    // the fixtures declare who liked what, and the number on a card is a
    // cache of those rows rather than a figure of its own.
    posts: [...clone(mockPosts), ...clone(mockPastPosts)].map((post) => ({
      ...post,
      likeCount: likeCountFor(post._id),
    })),
    signups: clone(mockSignups),
    follows: clone(mockFollows),
    likes: clone(mockLikes),
    memberships: clone(mockMemberships),
    iqamah: clone(mockIqamah),
    jummah: clone(mockJummah),
    prefs: clone(defaultNotificationPrefs),
    // Nothing is seeded: an inbox is a log of what happened while you were
    // using the app, and pre-filling it with fixture rows would show a badge
    // for messages nobody sent.
    notifications: [],
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

/**
 * Recount one post's likes and write the number back onto it, exactly as the
 * server's `settle` does — so the card reads the same field either way.
 */
function likeResult(postId: ID, liked: boolean): LikeResult {
  const likeCount = state.likes.filter((l) => l.postId === postId).length;
  const post = state.posts.find((p) => p._id === postId);
  if (post) post.likeCount = likeCount;
  return { postId, likeCount, liked };
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

/**
 * The server's `deliver`: one inbox row per recipient.
 *
 * The mock keeps a single global `prefs` object rather than one per user, so
 * the preference gate is applied once here rather than per recipient. That is
 * the one place this drifts from the server, and it drifts in the direction
 * that matters — the signed-in user's own prefs are the ones being honoured.
 */
function deliverMock(
  recipientIds: ID[],
  fields: Omit<AppNotification, '_id' | 'userId' | 'createdAt'>,
): number {
  const createdAt = new Date().toISOString();
  for (const userId of recipientIds) {
    state.notifications.push({ ...fields, _id: makeId('notif'), userId, createdAt });
  }
  return recipientIds.length;
}

/** Everyone who follows this mosque, minus whoever is sending. */
function followerIds(mosqueId: ID, exceptUserId: ID): ID[] {
  return state.follows
    .filter((f) => f.mosqueId === mosqueId && f.userId !== exceptUserId)
    .map((f) => f.userId);
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

    // Reliability counts every signup of theirs here, not just the confirmed
    // ones — a late cancellation flips the row to `withdrawn`, so filtering to
    // confirmed first would hide exactly what we are trying to count.
    const everything = state.signups.filter((s) => s.userId === userId && postIds.has(s.postId));
    const lateCancellations = everything.filter((s) => s.lateCancelledAt).length;
    const noShows = everything.filter((s) => s.noShowAt).length;
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
      lateCancellations,
      noShows,
    });
  }

  // Coordinators first, then whoever shows up most.
  return members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return b.attendedCount - a.attendedCount || a.name.localeCompare(b.name);
  });
}

/**
 * Mark confirmed signups on posts that have ended, and were never checked in,
 * as no-shows.
 *
 * On the server this is a sweep that runs as posts end. Here it runs lazily,
 * whenever something asks about reliability — the effect is the same and it
 * needs no timer. Idempotent: a row already stamped is left alone.
 */
function sweepNoShows(): void {
  const now = Date.now();
  const ended = new Map(
    state.posts
      .filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() < now)
      .map((p) => [p._id, p]),
  );
  for (const signup of state.signups) {
    if (signup.status !== 'confirmed' || signup.checkedInAt || signup.noShowAt) continue;
    const post = ended.get(signup.postId);
    if (post) signup.noShowAt = post.endAt;
  }
}

/** The incidents behind the counts, newest first. */
function buildIncidents(userId: ID, mosqueId?: ID): ReliabilityIncident[] {
  sweepNoShows();
  const postById = new Map(state.posts.map((p) => [p._id, p]));
  const out: ReliabilityIncident[] = [];

  for (const signup of state.signups) {
    if (signup.userId !== userId) continue;
    const post = postById.get(signup.postId);
    if (!post || (mosqueId && post.mosqueId !== mosqueId)) continue;

    const base = {
      postId: post._id,
      postTitle: post.title,
      mosqueId: post.mosqueId,
      startAt: post.startAt,
    };
    if (signup.lateCancelledAt) {
      out.push({ ...base, kind: 'late-cancel', at: signup.lateCancelledAt });
    }
    if (signup.noShowAt) out.push({ ...base, kind: 'no-show', at: signup.noShowAt });
  }

  return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
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
    const email = input.email.trim().toLowerCase();
    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      throw new ApiRequestError(API_ERROR.EMAIL_TAKEN, 'That email already has an account.', 409);
    }
    const user: User = {
      _id: makeId('user'),
      name: input.name.trim(),
      email,
      interests: [],
    };
    state.users.push(user);
    state.currentUserId = user._id;

    // Coordinator access is granted, never requested. If the mosque gave us
    // this email it holds the admin role from its first session; if not, the
    // account is an ordinary member and no screen in the app can change that.
    const mosqueId = coordinatorMosqueFor(email);
    if (mosqueId) {
      state.memberships.push({
        _id: makeId('member'),
        userId: user._id,
        mosqueId,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
      // A coordinator follows the mosque they run, so its feed is theirs too.
      state.follows.push({
        _id: makeId('follow'),
        userId: user._id,
        mosqueId,
        createdAt: new Date().toISOString(),
      });
    }

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

  /**
   * The mock has no filesystem and no server, so there is nothing here to
   * upload to. It exists because `MEnsembleApi` requires it and the oracle
   * tests instantiate the whole surface; every screen that uploads talks to
   * the HTTP client. Failing loudly beats returning a path that resolves to
   * nothing and shows up later as a broken image.
   */
  async uploadPoster(): Promise<never> {
    throw new Error('uploadPoster: the mock client has nowhere to put a file');
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

    // The fan-out: followers who list this category among their interests get
    // an inbox row, and a push if their device is registered for one.
    const audience = followerIds(input.mosqueId, user._id).filter((id) =>
      state.users.find((u) => u._id === id)?.interests.includes(input.category),
    );
    deliverMock(audience, {
      mosqueId: input.mosqueId,
      kind: 'post',
      title: post.title,
      body: post.description,
      postId: post._id,
    });

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

  async updateMosque(mosqueId, patch) {
    requireAdmin(mosqueId);
    const mosque = requireMosque(mosqueId);

    // Only the editable half. Identity — name, address, coordinates, join code —
    // is not patchable from the app, so spreading the whole body is not safe.
    if (patch.bio !== undefined) mosque.bio = patch.bio || undefined;
    if (patch.history !== undefined) mosque.history = patch.history || undefined;
    if (patch.website !== undefined) mosque.website = patch.website || undefined;
    if (patch.phone !== undefined) mosque.phone = patch.phone || undefined;
    if (patch.services !== undefined) {
      const cleaned = patch.services.map((s) => s.trim()).filter(Boolean);
      mosque.services = cleaned.length ? cleaned : undefined;
    }
    if (patch.social !== undefined) {
      // A replace, not a merge — same as the server. Emptying a field is the
      // only way to remove a link, so a merge would make one permanent.
      const social: MosqueSocial = {};
      for (const platform of SOCIAL_PLATFORMS) {
        const raw = patch.social[platform];
        const url = raw === undefined ? null : normalizeSocial(platform, raw);
        if (url) social[platform] = url;
      }
      mosque.social = Object.keys(social).length ? social : undefined;
    }

    return delay(clone(mosque));
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
    // Stamp no-shows first so the 30-day counts below include posts that have
    // ended since anyone last looked.
    sweepNoShows();
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
    const monthAgo = now - 30 * DAY_MS;

    // The 30-day window: all-time numbers flatter a mosque that was busy a year
    // ago, and a coordinator is deciding about now.
    const endedRecentlyIds = new Set(
      ended.filter((p) => new Date(p.endAt).getTime() >= monthAgo).map((p) => p._id),
    );
    const confirmedRecent = confirmedEnded.filter((s) => endedRecentlyIds.has(s.postId));
    const attendedRecent = confirmedRecent.filter((s) => s.checkedInAt);

    // Every row, not just the confirmed ones — a late cancellation flips the
    // row to withdrawn and would otherwise vanish from these counts.
    const postIds = new Set(posts.map((p) => p._id));
    const allSignups = state.signups.filter((s) => postIds.has(s.postId));
    const since = (iso?: string) => !!iso && new Date(iso).getTime() >= monthAgo;

    // Judged against their whole history here, so someone returning after two
    // years is not counted as a first-timer.
    const firstSignupAt = new Map<ID, number>();
    for (const s of allSignups) {
      if (!s.createdAt) continue;
      const at = new Date(s.createdAt).getTime();
      const seen = firstSignupAt.get(s.userId);
      if (seen === undefined || at < seen) firstSignupAt.set(s.userId, at);
    }
    const activeRecently = new Set(
      allSignups.filter((s) => s.status === 'confirmed' && since(s.createdAt)).map((s) => s.userId),
    );

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

      startingSoon: live.filter((p) => new Date(p.startAt).getTime() <= now + DAY_MS).length,
      postsWithNoSignups: live.filter(
        (p) => p.type === 'volunteer' && !confirmedLive.some((s) => s.postId === p._id),
      ).length,
      newFollowers7d: state.follows.filter(
        (f) => f.mosqueId === mosqueId && new Date(f.createdAt).getTime() >= now - 7 * DAY_MS,
      ).length,
      activeVolunteers30d: activeRecently.size,
      firstTimeVolunteers30d: [...activeRecently].filter(
        (userId) => (firstSignupAt.get(userId) ?? 0) >= monthAgo,
      ).length,
      lateCancellations30d: allSignups.filter((s) => since(s.lateCancelledAt)).length,
      noShows30d: allSignups.filter((s) => since(s.noShowAt)).length,
      attendanceRate30d: confirmedRecent.length
        ? Math.round((attendedRecent.length / confirmedRecent.length) * 100)
        : 0,
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

    return delay<MemberDetail>({
      member,
      history,
      incidents: buildIncidents(userId, mosqueId),
    });
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

  // ---------------------------------------------------------------- likes ---

  async likePost(postId) {
    const user = requireUser();
    requirePost(postId);
    const already = state.likes.some((l) => l.userId === user._id && l.postId === postId);
    if (!already) {
      state.likes.push({
        _id: makeId('like'),
        userId: user._id,
        postId,
        createdAt: new Date().toISOString(),
      });
    }
    return delay(likeResult(postId, true));
  },

  async unlikePost(postId) {
    const user = requireUser();
    requirePost(postId);
    state.likes = state.likes.filter((l) => !(l.userId === user._id && l.postId === postId));
    return delay(likeResult(postId, false));
  },

  async getMyLikes() {
    const user = requireUser();
    return delay(state.likes.filter((l) => l.userId === user._id).map((l) => l.postId));
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
    // The clock is read here, at the write — not on the client before it. The
    // app shows a warning based on the same rule, but what actually goes on the
    // record is decided at this moment.
    const hoursBefore = (new Date(post.startAt).getTime() - Date.now()) / 3_600_000;
    const lateCancelled = hoursBefore < LATE_CANCEL_HOURS;

    signup.status = 'withdrawn';
    delete signup.checkedInAt;
    if (lateCancelled) signup.lateCancelledAt = new Date().toISOString();
    post.slotsFilled = Math.max(0, post.slotsFilled - 1);

    return delay({ lateCancelled, hoursBefore: Math.max(0, Math.round(hoursBefore * 10) / 10) });
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

  async getMyReliability() {
    const user = requireUser();
    sweepNoShows();

    const now = Date.now();
    const endedPostIds = new Set(
      state.posts
        .filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() < now)
        .map((p) => p._id),
    );

    const mine = state.signups.filter((s) => s.userId === user._id);
    // "Commitments" is what they were still signed up for when the post ran —
    // an early withdrawal was never a commitment and must not count against
    // them, which is the whole reason cancelling early is free.
    const commitments = mine.filter(
      (s) => s.status === 'confirmed' && endedPostIds.has(s.postId),
    ).length;
    const attended = mine.filter((s) => s.checkedInAt && endedPostIds.has(s.postId)).length;

    return delay<ReliabilityRecord>({
      commitments,
      attended,
      lateCancellations: mine.filter((s) => s.lateCancelledAt).length,
      noShows: mine.filter((s) => s.noShowAt).length,
      // Nothing to judge yet reads as 100, not 0 — a new volunteer has not
      // failed anything.
      reliabilityRate: commitments === 0 ? 100 : Math.round((attended / commitments) * 100),
      recent: buildIncidents(user._id).slice(0, 10),
    });
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

  // -------------------------------------------------------- notifications ---

  async getNotifications(): Promise<NotificationFeed> {
    const user = requireUser();
    const mine = state.notifications
      .filter((n) => n.userId === user._id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return delay({
      items: clone(mine),
      unread: mine.filter((n) => !n.readAt).length,
    });
  },

  async markNotificationsRead(): Promise<NotificationFeed> {
    const user = requireUser();
    const at = new Date().toISOString();
    for (const n of state.notifications) {
      if (n.userId === user._id && !n.readAt) n.readAt = at;
    }
    return this.getNotifications();
  },

  async broadcast(mosqueId: ID, input: BroadcastInput) {
    const user = requireAdmin(mosqueId);
    requireMosque(mosqueId);

    // `announcements` gates this the same way it gates an announcement post —
    // from the reader's side the two are the same thing.
    const audience = state.prefs.announcements ? followerIds(mosqueId, user._id) : [];
    const recipients = deliverMock(audience, {
      mosqueId,
      kind: 'mosque',
      title: input.title.trim(),
      body: input.body.trim(),
    });

    // Nothing here talks to Expo, so nothing is ever pushed. Saying 0 rather
    // than guessing keeps the send screen honest in a mock run.
    return delay({ recipients, pushed: 0 });
  },

  async registerPushToken(token) {
    const user = requireUser();
    user.pushToken = token;
    return delay(undefined);
  },
};
