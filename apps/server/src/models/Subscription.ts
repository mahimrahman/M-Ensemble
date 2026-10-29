import { Schema, model, type HydratedDocument } from 'mongoose';
import type { CollectionMethod, Subscription } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * A mosque's billing arrangement with us, and until when.
 *
 * **There is no tier.** Every mosque gets the whole product; what this row
 * carries is whether they are paying, how much was agreed, and why if it is not
 * the standard price. One row per mosque, enforced by the unique index — the
 * history of what they were charged lives in the invoices, which is where
 * anyone asking that question is actually looking.
 *
 * **`collection` is stored as `collectionMethod`.** The contract calls the
 * field `collection`, but that is a reserved path name in Mongoose — it would
 * shadow `Document#collection`, which Mongoose itself reads while saving. The
 * `toJSON` transform renames it back, so nothing outside this file sees the
 * difference.
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
  | 'collection'
> {
  collectionMethod: CollectionMethod;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const json = contractJson();

const subscriptionSchema = new Schema<SubscriptionRecord>(
  {
    _id: { type: String, required: true },
    mosqueId: { type: String, required: true },
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
    // The Stripe side. `externalRef` is the Stripe subscription id once a
    // Checkout link has been paid; until then the mosque is on the manual path.
    externalRef: { type: String },
    collectionMethod: { type: String, enum: ['stripe', 'manual'], default: 'manual' },
    stripeCustomerId: { type: String },
    lastStripeInvoiceStatus: { type: String },
    province: { type: String, default: 'QC' },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  {
    ...json,
    toJSON: {
      ...json.toJSON,
      transform(doc: unknown, ret: Record<string, unknown>) {
        const out = json.toJSON.transform(doc, ret);
        if (out.collectionMethod !== undefined) {
          out.collection = out.collectionMethod;
          delete out.collectionMethod;
        }
        return out;
      },
    },
  },
);

subscriptionSchema.index({ mosqueId: 1 }, { unique: true });
// The billing screen groups by status, and MRR sums over it.
subscriptionSchema.index({ status: 1 });
// Webhooks arrive with Stripe's ids, not ours.
subscriptionSchema.index({ externalRef: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });

export type SubscriptionDocument = HydratedDocument<SubscriptionRecord>;
export const SubscriptionModel = model<SubscriptionRecord>('Subscription', subscriptionSchema);
