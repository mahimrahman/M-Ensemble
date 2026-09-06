import type { MosqueDashboard } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { sweepNoShows } from './reliability.service.js';
import { DAY_MS, isEnded, isLive, postMinutes } from '../utils/time.js';

/**
 * Every number on the coordinator's home screen, in one round trip.
 *
 * A derived view over posts, signups and follows — never a second source of
 * truth. Volume is tiny (tens of posts, dozens of signups), so this is two
 * indexed finds and a reduce rather than an aggregation pipeline.
 *
 * The formulas mirror the mock exactly, including the asymmetry that
 * `minutesServed` counts **only volunteer posts** while `/me/hours` counts
 * every type.
 */
export async function buildDashboard(mosqueId: string): Promise<MosqueDashboard> {
  // Stamp any no-shows first, so `noShows30d` counts posts that have ended
  // since the last time anyone looked at this mosque.
  await sweepNoShows(mosqueId);

  const now = Date.now();
  const posts = await PostModel.find({ mosqueId });

  const live = posts.filter((p) => isLive(p, now));
  const ended = posts.filter((p) => isEnded(p, now));
  const liveIds = new Set(live.map((p) => p._id));
  const endedIds = new Set(ended.map((p) => p._id));
  const byId = new Map(posts.map((p) => [p._id, p]));

  const volunteer = live.filter((p) => p.type === 'volunteer' && p.slotsNeeded !== undefined);
  const slotsNeeded = volunteer.reduce((sum, p) => sum + (p.slotsNeeded ?? 0), 0);
  const slotsUnfilled = volunteer.reduce(
    (sum, p) => sum + Math.max(0, (p.slotsNeeded ?? 0) - p.slotsFilled),
    0,
  );

  const confirmed = await SignupModel.find({
    postId: { $in: [...liveIds, ...endedIds] },
    status: 'confirmed',
  });

  const confirmedLive = confirmed.filter((s) => liveIds.has(s.postId));
  const confirmedEnded = confirmed.filter((s) => endedIds.has(s.postId));
  const attendedEnded = confirmedEnded.filter((s) => s.checkedInAt);

  const minutesServed = attendedEnded.reduce((sum, s) => {
    const post = byId.get(s.postId);
    return post && post.type === 'volunteer' ? sum + postMinutes(post) : sum;
  }, 0);

  const cutoff = now + 7 * DAY_MS;
  const monthAgo = now - 30 * DAY_MS;

  // The 30-day window. All-time numbers flatter a mosque that was busy a year
  // ago; these say what is happening now, which is what a coordinator is
  // deciding on.
  const endedRecently = ended.filter((p) => p.endAt.getTime() >= monthAgo);
  const endedRecentlyIds = new Set(endedRecently.map((p) => p._id));
  const confirmedRecent = confirmedEnded.filter((s) => endedRecentlyIds.has(s.postId));
  const attendedRecent = confirmedRecent.filter((s) => s.checkedInAt);

  // Reliability needs *every* row, not just the confirmed ones: a late
  // cancellation flips the row to withdrawn.
  const allSignups = await SignupModel.find({ postId: { $in: posts.map((p) => p._id) } });
  const since = (d?: Date) => !!d && d.getTime() >= monthAgo;

  // "First time here" is judged against their whole history at this mosque, so
  // someone who volunteered two years ago and came back is not counted as new.
  const firstSignupAt = new Map<string, number>();
  for (const s of allSignups) {
    const at = s.createdAt?.getTime();
    if (at === undefined) continue;
    const seen = firstSignupAt.get(s.userId);
    if (seen === undefined || at < seen) firstSignupAt.set(s.userId, at);
  }

  const activeRecently = new Set(
    allSignups.filter((s) => s.status === 'confirmed' && since(s.createdAt)).map((s) => s.userId),
  );

  return {
    mosqueId,
    upcomingCount: live.filter((p) => p.startAt.getTime() <= cutoff).length,
    slotsUnfilled,
    slotsNeeded,
    newSignups24h: confirmedLive.filter(
      (s) => s.createdAt && now - s.createdAt.getTime() < DAY_MS,
    ).length,
    activePeople: new Set(confirmedLive.map((s) => s.userId)).size,
    followerCount: await FollowModel.countDocuments({ mosqueId }),
    attendanceRate: confirmedEnded.length
      ? Math.round((attendedEnded.length / confirmedEnded.length) * 100)
      : 0,
    minutesServed,

    startingSoon: live.filter((p) => p.startAt.getTime() <= now + DAY_MS).length,
    postsWithNoSignups: live.filter(
      (p) => p.type === 'volunteer' && !confirmedLive.some((s) => s.postId === p._id),
    ).length,
    newFollowers7d: await FollowModel.countDocuments({
      mosqueId,
      createdAt: { $gte: new Date(now - 7 * DAY_MS) },
    }),
    activeVolunteers30d: activeRecently.size,
    firstTimeVolunteers30d: [...activeRecently].filter(
      (userId) => (firstSignupAt.get(userId) ?? 0) >= monthAgo,
    ).length,
    lateCancellations30d: allSignups.filter((s) => since(s.lateCancelledAt)).length,
    noShows30d: allSignups.filter((s) => since(s.noShowAt)).length,
    attendanceRate30d: confirmedRecent.length
      ? Math.round((attendedRecent.length / confirmedRecent.length) * 100)
      : 0,
  };
}
