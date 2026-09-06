import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Follow } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * Public, drives the feed. Deliberately separate from `Membership` — mixing the
 * two tangles cross-mosque admin rights, and a coordinator need not follow the
 * mosque they run.
 */
export interface FollowRecord extends Omit<Follow, 'createdAt'> {
  createdAt: Date;
}

const followSchema = new Schema<FollowRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    mosqueId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

followSchema.index({ userId: 1, mosqueId: 1 }, { unique: true });
followSchema.index({ mosqueId: 1 });

export type FollowDocument = HydratedDocument<FollowRecord>;
export const FollowModel = model<FollowRecord>('Follow', followSchema);
