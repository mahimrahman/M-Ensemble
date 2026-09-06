import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Membership } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/** Role-bearing, drives permissions. Never merged into `Follow`. */
export interface MembershipRecord extends Omit<Membership, 'createdAt'> {
  createdAt: Date;
}

const membershipSchema = new Schema<MembershipRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    mosqueId: { type: String, required: true },
    role: { type: String, required: true, enum: ['member', 'admin'] },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

membershipSchema.index({ userId: 1, mosqueId: 1 }, { unique: true });
// GET /me/memberships runs on every cold start and decides which shell the
// session lands in — this index is what keeps it a single lookup.
membershipSchema.index({ userId: 1 });

export type MembershipDocument = HydratedDocument<MembershipRecord>;
export const MembershipModel = model<MembershipRecord>('Membership', membershipSchema);
