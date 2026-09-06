import type { PostType, RosterEntry } from '@m-ensemble/shared';
import type { PostDocument } from '../models/Post.js';
import type { SignupDocument } from '../models/Signup.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { UserModel } from '../models/User.js';
import { asContract } from '../utils/serialize.js';

export interface RosterFilterInput {
  upcoming?: boolean;
  types?: PostType[];
  post?: string;
}

/** Flattens a signup against its post — the shape every admin list renders. */
export function toRosterEntry(
  signup: SignupDocument,
  post: PostDocument,
  name: string,
): RosterEntry {
  return {
    signup: asContract<RosterEntry['signup']>(signup),
    postId: post._id,
    postTitle: post.title,
    postType: post.type,
    startAt: post.startAt.toISOString(),
    endAt: post.endAt.toISOString(),
    userId: signup.userId,
    userName: name,
  };
}

/**
 * Confirmed signups across the mosque's live-or-past posts, soonest first.
 * `upcoming` drops anything already over — the list you work from on the day.
 * Cancelled posts never appear.
 */
export async function buildRoster(
  mosqueId: string,
  filter: RosterFilterInput = {},
): Promise<RosterEntry[]> {
  const now = new Date();

  const posts = await PostModel.find({
    mosqueId,
    cancelledAt: { $exists: false },
    ...(filter.post ? { _id: filter.post } : {}),
    ...(filter.types?.length ? { type: { $in: filter.types } } : {}),
    ...(filter.upcoming ? { endAt: { $gte: now } } : {}),
  });

  const postById = new Map(posts.map((p) => [p._id, p]));
  if (postById.size === 0) return [];

  const signups = await SignupModel.find({
    postId: { $in: [...postById.keys()] },
    status: 'confirmed',
  });

  const users = await UserModel.find({ _id: { $in: signups.map((s) => s.userId) } });
  const nameById = new Map(users.map((u) => [u._id, u.name]));

  return signups
    .map((s) => toRosterEntry(s, postById.get(s.postId)!, nameById.get(s.userId) ?? '—'))
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}
