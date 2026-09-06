import type { MemberDetail, MemberRole, MosqueMember, RosterEntry } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MembershipModel } from '../models/Membership.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { UserModel } from '../models/User.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { postMinutes } from '../utils/time.js';
import { toRosterEntry } from './roster.service.js';
import { buildIncidents, sweepNoShows } from './reliability.service.js';

/**
 * The mosque's people, scored by what they have actually turned up to.
 *
 * The set is the **union** of three groups: everyone who follows the mosque,
 * everyone holding a role at it, and anyone who has ever signed up for one of
 * its posts. A coordinator need not follow the mosque they run, and someone who
 * claimed a shift without following still belongs in the directory.
 */
export async function buildMembers(mosqueId: string): Promise<MosqueMember[]> {
  // Stamp any no-shows this mosque has accrued before counting them, so the
  // coordinator's numbers and the volunteer's own profile agree.
  await sweepNoShows(mosqueId);

  const posts = await PostModel.find({ mosqueId });
  const postById = new Map(posts.map((p) => [p._id, p]));
  const postIds = [...postById.keys()];

  const [follows, memberships, signups] = await Promise.all([
    FollowModel.find({ mosqueId }),
    MembershipModel.find({ mosqueId }),
    SignupModel.find({ postId: { $in: postIds } }),
  ]);

  const joinedAt = new Map<string, Date>();
  for (const follow of follows) joinedAt.set(follow.userId, follow.createdAt);

  const roleOf = new Map<string, MemberRole>();
  for (const m of memberships) {
    roleOf.set(m.userId, m.role);
    const seen = joinedAt.get(m.userId);
    if (!seen || m.createdAt < seen) joinedAt.set(m.userId, m.createdAt);
  }

  // Signup-only people join the directory dated by their earliest signup.
  for (const signup of signups) {
    if (joinedAt.has(signup.userId)) continue;
    joinedAt.set(signup.userId, signup.createdAt ?? new Date());
  }

  const users = await UserModel.find({ _id: { $in: [...joinedAt.keys()] } });
  const userById = new Map(users.map((u) => [u._id, u]));

  const members: MosqueMember[] = [];
  for (const [userId, joined] of joinedAt) {
    const user = userById.get(userId);
    if (!user) continue;

    const mine = signups.filter((s) => s.userId === userId && s.status === 'confirmed');
    const attended = mine.filter((s) => s.checkedInAt);

    // Every row of theirs here, not just the confirmed ones — a late
    // cancellation flips the row to `withdrawn`, so filtering to confirmed
    // first would hide exactly what these two counts exist to show.
    const everything = signups.filter((s) => s.userId === userId);

    const minutesServed = attended.reduce((sum, s) => {
      const post = postById.get(s.postId);
      return post && post.type === 'volunteer' ? sum + postMinutes(post) : sum;
    }, 0);

    const lastSeen = attended
      .map((s) => s.checkedInAt as Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    members.push({
      userId,
      name: user.name,
      role: roleOf.get(userId) ?? 'member',
      joinedAt: joined.toISOString(),
      signupCount: mine.length,
      attendedCount: attended.length,
      minutesServed,
      // Omitted, not null — the contract marks it optional and the app renders
      // "never seen" on absence.
      ...(lastSeen ? { lastSeenAt: lastSeen.toISOString() } : {}),
      interests: [...user.interests],
      lateCancellations: everything.filter((s) => s.lateCancelledAt).length,
      noShows: everything.filter((s) => s.noShowAt).length,
    });
  }

  // Coordinators first, then whoever shows up most, then alphabetical.
  return members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return b.attendedCount - a.attendedCount || a.name.localeCompare(b.name);
  });
}

/** One person's row plus every confirmed signup of theirs here, newest first. */
export async function buildMemberDetail(
  mosqueId: string,
  userId: string,
): Promise<MemberDetail> {
  const member = (await buildMembers(mosqueId)).find((m) => m.userId === userId);
  if (!member) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'Nobody here by that id.');
  }

  const posts = await PostModel.find({ mosqueId });
  const postById = new Map(posts.map((p) => [p._id, p]));

  const signups = await SignupModel.find({
    userId,
    postId: { $in: [...postById.keys()] },
    status: 'confirmed',
  });

  const history: RosterEntry[] = signups
    .map((s) => toRosterEntry(s, postById.get(s.postId)!, member.name))
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

  return { member, history, incidents: await buildIncidents(userId, mosqueId) };
}

/**
 * Promote or demote. Never touches `Follow` — losing a role does not
 * unsubscribe you from the mosque's feed.
 */
export async function setMemberRole(
  mosqueId: string,
  actorId: string,
  userId: string,
  role: MemberRole,
): Promise<MosqueMember> {
  // Demoting yourself would lock you out of the screen you're standing on.
  if (actorId === userId && role !== 'admin') {
    throw new HttpError(403, ERROR.FORBIDDEN, 'You cannot remove your own coordinator role.');
  }

  await MembershipModel.findOneAndUpdate(
    { mosqueId, userId },
    { $set: { role }, $setOnInsert: { _id: newId(), createdAt: new Date() } },
    { upsert: true },
  );

  const member = (await buildMembers(mosqueId)).find((m) => m.userId === userId);
  if (!member) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'Nobody here by that id.');
  }
  return member;
}
