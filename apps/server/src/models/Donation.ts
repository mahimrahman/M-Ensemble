import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Donation } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * Money passing through us to a mosque, with our fee split out.
 *
 * **Recorded, not processed.** Nothing charges a card here — rows are entered
 * or imported by a super admin and moved through `status` by hand. When a
 * processor is connected it writes the same rows, which is why `reference` and
 * `method` already exist.
 *
 * `feeCents` and `netCents` are both stored even though either could be
 * derived from the other. A fee schedule that changes next quarter must not
 * retroactively alter what a mosque was actually owed last quarter.
 */
export interface DonationRecord extends Omit<Donation, 'payoutAt' | 'createdAt'> {
  payoutAt?: Date;
  createdAt: Date;
}

const donationSchema = new Schema<DonationRecord>(
  {
    _id: { type: String, required: true },
    mosqueId: { type: String, required: true },
    userId: { type: String },
    postId: { type: String },
    donorName: { type: String, trim: true },
    donorEmail: { type: String, trim: true, lowercase: true },
    amountCents: { type: Number, required: true, min: 0 },
    feeCents: { type: Number, required: true, min: 0 },
    netCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'CAD' },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'settled', 'refunded', 'failed'],
      default: 'pending',
    },
    method: {
      type: String,
      required: true,
      enum: ['manual', 'etransfer', 'cheque', 'cash', 'card', 'other'],
      default: 'manual',
    },
    reference: { type: String },
    payoutAt: { type: Date },
    note: { type: String },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

donationSchema.index({ mosqueId: 1, createdAt: -1 });
// "What came in this month, and what do we owe out" — both read this.
donationSchema.index({ status: 1, createdAt: -1 });

export type DonationDocument = HydratedDocument<DonationRecord>;
export const DonationModel = model<DonationRecord>('Donation', donationSchema);
