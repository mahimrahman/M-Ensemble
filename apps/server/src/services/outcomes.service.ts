import type { EventOutcome } from '@m-ensemble/shared';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';

/**
 * How turnout actually went, newest first.
 *
 * Posts that have already ended, excluding announcements — an announcement has
 * nobody to turn up. `target` is whatever the post asked for, or null when it
 * asked for nothing.
 */
export async function buildOutcomes(mosqueId: string): Promise<EventOutcome[]> {
  const ended = await PostModel.find({
    mosqueId,
    cancelledAt: { $exists: false },
    type: { $ne: 'announcement' },
    endAt: { $lt: new Date() },
  }).sort({ startAt: -1 });

  if (ended.length === 0) return [];

  const signups = await SignupModel.find({
    postId: { $in: ended.map((p) => p._id) },
    status: 'confirmed',
  });

  return ended.map<EventOutcome>((post) => {
    const confirmed = signups.filter((s) => s.postId === post._id);
    return {
      postId: post._id,
      title: post.title,
      type: post.type,
      startAt: post.startAt.toISOString(),
      endAt: post.endAt.toISOString(),
      confirmed: confirmed.length,
      attended: confirmed.filter((s) => s.checkedInAt).length,
      target: post.slotsNeeded ?? post.capacity ?? null,
    };
  });
}
