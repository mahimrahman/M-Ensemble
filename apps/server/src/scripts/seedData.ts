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
 */

import bcrypt from 'bcryptjs';
import {
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

export async function seedAll(options: SeedOptions = {}): Promise<SeedCounts> {
  const rounds = options.bcryptRounds ?? 10;
  await clearAll();

  // One hash for everybody — every fixture user signs in with MOCK_PASSWORD.
  const passwordHash = await bcrypt.hash(MOCK_PASSWORD, rounds);

  await UserModel.insertMany(
    mockUsers.map((user) => ({
      ...user,
      passwordHash,
      notificationPrefs: { ...defaultNotificationPrefs },
    })),
  );

  await MosqueModel.insertMany(mockMosques.map((mosque) => ({ ...mosque })));

  await FollowModel.insertMany(
    mockFollows.map((follow) => ({ ...follow, createdAt: new Date(follow.createdAt) })),
  );

  await MembershipModel.insertMany(
    mockMemberships.map((m) => ({ ...m, createdAt: new Date(m.createdAt) })),
  );

  // slotsFilled is inserted as given, never recomputed from signups — an event
  // can legitimately be 84/200 with no rows behind it.
  await PostModel.insertMany(
    [...mockPosts, ...mockPastPosts].map((post) => ({
      ...post,
      startAt: new Date(post.startAt),
      endAt: new Date(post.endAt),
      createdAt: new Date(post.createdAt),
      ...(post.cancelledAt ? { cancelledAt: new Date(post.cancelledAt) } : {}),
    })),
  );

  await SignupModel.insertMany(
    mockSignups.map((signup) => ({
      ...signup,
      // Both of these stay absent when the fixture omits them: two rows have no
      // createdAt on purpose, and the admin home branches on its presence.
      ...(signup.createdAt ? { createdAt: new Date(signup.createdAt) } : {}),
      ...(signup.checkedInAt ? { checkedInAt: new Date(signup.checkedInAt) } : {}),
    })),
  );

  // Neither shape carries an _id in the contract, so mint one per row.
  await IqamahConfigModel.insertMany(
    mockIqamah.map((row, i) => ({ ...row, _id: `iqamah_${String(i + 1).padStart(3, '0')}` })),
  );

  await JummahSessionModel.insertMany(
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
