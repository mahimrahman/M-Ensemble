import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Subscription } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * What a mosque is on, and until when.
 *
 * One row per mosque, enforced by the unique index — a mosque cannot be on two
 * plans at once, and "upgrade" is a field change rather than a second row. The
 * history of what they were on lives in the invoices, which is where anyone
 * asking that question is actually looking.
 */
export interface SubscriptionRecord extends Omit<
  Subscription,
  | 'startedAt'
  | 'currentPeriodStart'
  | 'currentPeriodEnd'
  | 'trialEndsAt'
  | 'cancelledAt'
  | 'createdAt'
  | 'updatedAt'
> {
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<SubscriptionRecord>(
  {
    _id: { type: String, required: true },
    mosqueId: { type: String, required: true },
    plan: { type: String, required: true, enum: ['free', 'standard', 'pro'] },
    status: {
      type: String,
      required: true,
      enum: ['active', 'trialing', 'past_due', 'cancelled'],
      default: 'active',
    },
    interval: { type: String, required: true, enum: ['monthly', 'yearly'], default: 'monthly' },
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'CAD' },
    startedAt: { type: Date, required: true },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    trialEndsAt: { type: Date },
    cancelledAt: { type: Date },
    note: { type: String },
    externalRef: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  contractJson(),
);

subscriptionSchema.index({ mosqueId: 1 }, { unique: true });
// The billing screen groups by both, and MRR sums over `status`.
subscriptionSchema.index({ status: 1, plan: 1 });

export type SubscriptionDocument = HydratedDocument<SubscriptionRecord>;
export const SubscriptionModel = model<SubscriptionRecord>('Subscription', subscriptionSchema);
