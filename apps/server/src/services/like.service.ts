import type { LikeResult } from '@m-ensemble/shared';
import { LikeModel } from '../models/Like.js';
import { PostModel } from '../models/Post.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';

/**
 * Like and unlike.
 *
 * Both are idempotent, and that is the whole design: a heart is tapped fast,
 * often twice, sometimes on two devices at once. So the row is written with an
 * upsert and the delete asks no questions, and neither cares how many times it
 * has already happened.
 *
 * `Post.likeCount` is a cache of `LikeModel.countDocuments({ postId })`, and it
 * is **recomputed on every write rather than incremented**. An `$inc` is one
 * query instead of two, but it compounds: once a count is wrong — a half-applied
 * write, a restored backup, a row deleted outside the app — every later tap
 * builds on the wrong number and it never comes back. Counting is one extra
 * indexed query on the `{postId}` index, on writes only, and it makes the
 * number on the card provably the number of rows behind it.
 */
async function settle(postId: string): Promise<number> {
  const likeCount = await LikeModel.countDocuments({ postId });
  await PostModel.updateOne({ _id: postId }, { $set: { likeCount } });
  return likeCount;
}

export async function likePost(postId: string, userId: string): Promise<LikeResult> {
  const post = await PostModel.findById(postId);
  if (!post) throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');

  await LikeModel.updateOne(
    { userId, postId },
    { $setOnInsert: { _id: newId(), userId, postId, createdAt: new Date() } },
    { upsert: true },
  );

  return { postId, liked: true, likeCount: await settle(postId) };
}

export async function unlikePost(postId: string, userId: string): Promise<LikeResult> {
  const post = await PostModel.findById(postId);
  if (!post) throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');

  await LikeModel.deleteOne({ userId, postId });

  return { postId, liked: false, likeCount: await settle(postId) };
}

/**
 * Every post this user has liked.
 *
 * One round trip on launch rather than a `likedByMe` on each post: the feed,
 * the mosque page and "My Stuff" all render the same hearts, and joining per
 * screen would ask the same question three times.
 */
export async function myLikedPostIds(userId: string): Promise<string[]> {
  const likes = await LikeModel.find({ userId }).select({ postId: 1, _id: 0 });
  return likes.map((like) => like.postId);
}
