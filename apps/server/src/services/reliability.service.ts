/**
 * Reliability — did people turn up to what they said they would.
 *
 * Two rules, and both of them are about fairness rather than punishment:
 *
 *   **Cancelling early is free.** Withdrawing more than `LATE_CANCEL_HOURS`
 *   before the start leaves no trace at all. We *want* someone who can no
 *   longer make it to say so while there is still time to find a replacement;
 *   a record that punished every withdrawal would teach people to stay silent
 *   and simply not show up, which is the worse outcome for the mosque.
 *
 *   **Only ended posts count.** A commitment you still have is not yet a
 *   commitment you kept or broke.
 *
 * `noShowAt` is written by the sweep below rather than at read time, so the
 * number a coordinator sees and the number the volunteer sees come from the
 * same stored fact and cannot drift.
 */

import type { ID, ReliabilityIncident, ReliabilityRecord } from '@m-ensemble/shared';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';

/**
 * Stamp `noShowAt` on confirmed signups whose post has ended with no check-in.
 *
 * Idempotent — `noShowAt: { $exists: false }` means a second run changes
 * nothing. Called before every reliability read, which is cheap at this data
 * volume and means there is no cron to forget to run. Scoped to one mosque
 * when the caller only needs that mosque's rows.
 */
export async function sweepNoShows(mosqueId?: ID): Promise<void> {
  const ended = await PostModel.find(
    {
      ...(mosqueId ? { mosqueId } : {}),
      cancelledAt: { $exists: false },
      endAt: { $lt: new Date() },
    },
    { _id: 1 },
  );
  if (ended.length === 0) return;

  await SignupModel.updateMany(
    {
      postId: { $in: ended.map((p) => p._id) },
      status: 'confirmed',
      checkedInAt: { $exists: false },
      noShowAt: { $exists: false },
    },
    [{ $set: { noShowAt: '$$NOW' } }],
  );
}

/** The incidents behind the counts, newest first. */
export async function buildIncidents(
  userId: ID,
  mosqueId?: ID,
): Promise<ReliabilityIncident[]> {
  const signups = await SignupModel.find({
    userId,
    $or: [{ lateCancelledAt: { $exists: true } }, { noShowAt: { $exists: true } }],
  });
  if (signups.length === 0) return [];

  const posts = await PostModel.find({
    _id: { $in: signups.map((s) => s.postId) },
    ...(mosqueId ? { mosqueId } : {}),
  });
  const postById = new Map(posts.map((p) => [p._id, p]));

  const out: ReliabilityIncident[] = [];
  for (const signup of signups) {
    const post = postById.get(signup.postId);
    if (!post) continue;

    const base = {
      postId: post._id,
      postTitle: post.title,
      mosqueId: post.mosqueId,
      startAt: post.startAt.toISOString(),
    };
    if (signup.lateCancelledAt) {
      out.push({ ...base, kind: 'late-cancel', at: signup.lateCancelledAt.toISOString() });
    }
    if (signup.noShowAt) {
      out.push({ ...base, kind: 'no-show', at: signup.noShowAt.toISOString() });
    }
  }

  return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

/** One volunteer's record across every mosque — what their own profile shows. */
export async function buildReliability(userId: ID): Promise<ReliabilityRecord> {
  await sweepNoShows();

  const signups = await SignupModel.find({ userId });
  const endedIds = new Set(
    (
      await PostModel.find(
        {
          _id: { $in: signups.map((s) => s.postId) },
          cancelledAt: { $exists: false },
          endAt: { $lt: new Date() },
        },
        { _id: 1 },
      )
    ).map((p) => p._id),
  );

  // An early withdrawal was never a commitment — it is not counted here, which
  // is exactly what makes cancelling early free.
  const commitments = signups.filter(
    (s) => s.status === 'confirmed' && endedIds.has(s.postId),
  ).length;
  const attended = signups.filter((s) => s.checkedInAt && endedIds.has(s.postId)).length;

  return {
    commitments,
    attended,
    lateCancellations: signups.filter((s) => s.lateCancelledAt).length,
    noShows: signups.filter((s) => s.noShowAt).length,
    // Nothing to judge yet reads as 100, not 0: a volunteer who has never been
    // asked to show up anywhere has not failed to.
    reliabilityRate: commitments === 0 ? 100 : Math.round((attended / commitments) * 100),
    recent: (await buildIncidents(userId)).slice(0, 10),
  };
}
