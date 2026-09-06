import type { MosqueDashboard } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
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
  };
}
