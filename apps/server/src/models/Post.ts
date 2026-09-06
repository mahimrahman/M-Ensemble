import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Post } from '@m-ensemble/shared';
import { SUBDOCUMENT, contractJson } from '../utils/serialize.js';

/**
 * `startAt`/`endAt` are `Date` because the live/ended filters compare them.
 * The session pair are plain strings — never queried, and keeping them as
 * strings means the JSON transform has nothing to recurse into.
 *
 * `createdAt` is explicit, not `timestamps: true`: the fixtures carry
 * meaningful values spanning two days back, and managed timestamps would
 * flatten all 19 to seed time — every card would read "just now".
 */
export interface PostRecord extends Omit<Post, 'startAt' | 'endAt' | 'createdAt' | 'cancelledAt'> {
  startAt: Date;
  endAt: Date;
  createdAt: Date;
  cancelledAt?: Date;
}

const sessionSchema = new Schema({ startAt: String, endAt: String }, SUBDOCUMENT);

const postSchema = new Schema<PostRecord>(
  {
    _id: { type: String, required: true },
    mosqueId: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['event', 'class', 'volunteer', 'announcement'],
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    location: { type: String, required: true },
    slotsNeeded: { type: Number },
    slotsFilled: { type: Number, required: true, default: 0 },
    capacity: { type: Number },
    // `default: undefined` or Mongoose gives every post `sessions: []`, and the
    // create form reads `post.sessions?.length` to decide the session count.
    sessions: { type: [sessionSchema], default: undefined },
    imageUrl: { type: String },
    // Names artwork bundled with the app rather than hosted — see POSTER_ART
    // in the mobile app. The seed's programs use it; uploads set `imageUrl`.
    posterKey: { type: String },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
    cancelledAt: { type: Date },
  },
  contractJson(),
);

postSchema.index({ mosqueId: 1, startAt: 1 });
postSchema.index({ mosqueId: 1, endAt: 1 });
postSchema.index({ endAt: 1 });

export type PostDocument = HydratedDocument<PostRecord>;
export const PostModel = model<PostRecord>('Post', postSchema);
