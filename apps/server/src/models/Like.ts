import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Like } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * One heart. The row is the truth; `Post.likeCount` is a cache of how many
 * there are, kept in step by the same request that writes the row.
 *
 * The unique `{userId, postId}` index is what makes liking idempotent: a
 * double-tap, or two devices tapping together, produces one row and one
 * increment rather than two of each.
 */
export interface LikeRecord extends Omit<Like, 'createdAt'> {
  createdAt: Date;
}

const likeSchema = new Schema<LikeRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    postId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

likeSchema.index({ userId: 1, postId: 1 }, { unique: true });
likeSchema.index({ postId: 1 });

export type LikeDocument = HydratedDocument<LikeRecord>;
export const LikeModel = model<LikeRecord>('Like', likeSchema);
