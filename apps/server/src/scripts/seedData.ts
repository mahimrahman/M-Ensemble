/**
 * Turns the shared fixtures into database rows.
 *
 * Lives apart from `seed.ts` because the vitest harness reseeds before every
 * test and must not connect, print or exit. The fixtures come from
 * `@m-ensemble/shared` — the same module the mobile mock client reads, which is
 * the whole reason the demo walkthrough and the rehearsal show the same data.
 *
 * Every fixture date is computed when that module is imported, so a seed is
 * only correct for the day it ran. Re-seed on the morning of the demo.
 *
 * **Seeding deletes nothing.** It used to `deleteMany` all eight collections
 * first, which also wiped every account a real person had signed up with -
 * somebody onboarded, the seed ran, and their login started answering "email
 * or password incorrect". Every write is now an upsert keyed by `_id`, so
 * re-seeding refreshes the demo content and leaves real data untouched.
 *
 * `clearAll` still exists for the test harness and for `npm run seed:reset`,
 * which is the only route to the destructive behaviour and says so on the tin.
 */

import type { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  passwordFor,
  allMosques,
  defaultNotificationPrefs,
  mockFollows,
  mockIqamah,
  mockJummah,
  mockMemberships,
  mockPastPosts,
  mockPosts,
  mockSignups,
  mockUsers,
} from '../shared.js';
import {
  ALL_MODELS,
  FollowModel,
  IqamahConfigModel,
  JummahSessionModel,
  MembershipModel,
  MosqueModel,
  PostModel,
  SignupModel,
  UserModel,
} from '../models/index.js';

export interface SeedCounts {
  mosques: number;
  users: number;
  follows: number;
  memberships: number;
  posts: number;
  signups: number;
  iqamahconfigs: number;
  jummahsessions: number;
}

export interface SeedOptions {
  /**
   * bcrypt cost. 10 in production; the test harness drops it to 4 — 20 hashes
   * at cost 10 before every test is minutes of wall clock.
   */
  bcryptRounds?: number;
}

/**
 * Empties the eight collections and rebuilds their indexes.
 *
 * `deleteMany` rather than `collection.drop()`: dropping a collection takes its
 * indexes with it, and the unique `{postId, userId}` index on `Signup` is the
 * second guard on the slot race.
 */
export async function clearAll(): Promise<void> {
  for (const model of ALL_MODELS) {
    await model.deleteMany({});
  }
}

export async function syncAllIndexes(): Promise<void> {
  for (const model of ALL_MODELS) {
    await model.syncIndexes();
  }
}

/**
 * Upsert fixture rows by `_id`.
 *
 * `insertMany` would throw on the second run; `replaceOne` with `upsert` makes
 * seeding idempotent and, more importantly, *additive* - a row nobody seeded (a
 * real account, a shift someone claimed) matches no filter here and is left
 * exactly as it was.
 */
async function upsertAll<T extends { _id: string }>(
  // `Model<any>` on purpose: mongoose types `bulkWrite` per model with
  // overloads that no single structural signature satisfies, and pinning it
  // would mean a generic parameter per collection for no safety gain — the rows
  // are already checked against the fixture types by `T`.
  model: Model<any>,
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  await model.bulkWrite(
    rows.map((row) => ({
      replaceOne: { filter: { _id: row._id }, replacement: row, upsert: true },
    })),
  );
}

export async function seedAll(options: SeedOptions = {}): Promise<SeedCounts> {
  const rounds = options.bcryptRounds ?? 10;

  // Most seeded accounts share one password and only the demo coordinator has
  // its own, so hash per distinct password rather than per row: twenty bcrypts
  // at cost 10 is minutes of wall clock.
  const cache = new Map<string, string>();
  const hashFor = async (plain: string): Promise<string> => {
    const cached = cache.get(plain);
    if (cached) return cached;
    const hash = await bcrypt.hash(plain, rounds);
    cache.set(plain, hash);
    return hash;
  };

  await upsertAll(
    UserModel,
    await Promise.all(
      mockUsers.map(async (user) => ({
        ...user,
        passwordHash: await hashFor(passwordFor(user.email)),
        notificationPrefs: { ...defaultNotificationPrefs },
      })),
    ),
  );

  await upsertAll(
    MosqueModel,
    allMosques.map((mosque) => ({ ...mosque })),
  );

  await upsertAll(
    FollowModel,
    mockFollows.map((follow) => ({ ...follow, createdAt: new Date(follow.createdAt) })),
  );

  await upsertAll(
    MembershipModel,
    mockMemberships.map((m) => ({ ...m, createdAt: new Date(m.createdAt) })),
  );

  // slotsFilled is written as given, never recomputed from signups - an event
  // can legitimately be 84/200 with no rows behind it.
  await upsertAll(
    PostModel,
    [...mockPosts, ...mockPastPosts].map((post) => ({
      ...post,
      startAt: new Date(post.startAt),
      endAt: new Date(post.endAt),
      createdAt: new Date(post.createdAt),
      ...(post.cancelledAt ? { cancelledAt: new Date(post.cancelledAt) } : {}),
    })),
  );

  await upsertAll(
    SignupModel,
    mockSignups.map((signup) => ({
      ...signup,
      // Both stay absent when the fixture omits them: two rows have no
      // createdAt on purpose, and the admin home branches on its presence.
      ...(signup.createdAt ? { createdAt: new Date(signup.createdAt) } : {}),
      ...(signup.checkedInAt ? { checkedInAt: new Date(signup.checkedInAt) } : {}),
    })),
  );

  // Neither shape carries an _id in the contract, so mint one per row.
  await upsertAll(
    IqamahConfigModel,
    mockIqamah.map((row, i) => ({ ...row, _id: `iqamah_${String(i + 1).padStart(3, '0')}` })),
  );

  await upsertAll(
    JummahSessionModel,
    mockJummah.map((row, i) => ({ ...row, _id: `jummah_${String(i + 1).padStart(3, '0')}` })),
  );

  return countAll();
}

export async function countAll(): Promise<SeedCounts> {
  const [mosques, users, follows, memberships, posts, signups, iqamahconfigs, jummahsessions] =
    await Promise.all([
      MosqueModel.countDocuments(),
      UserModel.countDocuments(),
      FollowModel.countDocuments(),
      MembershipModel.countDocuments(),
      PostModel.countDocuments(),
      SignupModel.countDocuments(),
      IqamahConfigModel.countDocuments(),
      JummahSessionModel.countDocuments(),
    ]);

  return { mosques, users, follows, memberships, posts, signups, iqamahconfigs, jummahsessions };
}
