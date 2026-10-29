import { Schema, model, type HydratedDocument } from 'mongoose';

/**
 * Every Stripe webhook event we have seen, keyed by Stripe's own event id.
 *
 * This is the idempotency guard. Stripe retries anything that did not get a
 * 2xx and makes no promise about delivering an event once, so the handler
 * inserts here first and treats a duplicate key as "already done" — which is
 * what keeps a retried `invoice.paid` from minting a second invoice.
 *
 * `error` is set when a handler threw. The event still answers 200 (Stripe
 * would otherwise retry forever), so this row is the only record that
 * something went wrong and needs a human.
 */
export interface StripeEventRecord {
  _id: string;
  type: string;
  receivedAt: Date;
  processedAt?: Date;
  error?: string;
}

const stripeEventSchema = new Schema<StripeEventRecord>(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true },
    receivedAt: { type: Date, required: true },
    processedAt: { type: Date },
    error: { type: String },
  },
  { versionKey: false },
);

// "What failed recently" — the only query anyone runs on this collection.
stripeEventSchema.index({ receivedAt: -1 });

export type StripeEventDocument = HydratedDocument<StripeEventRecord>;
export const StripeEventModel = model<StripeEventRecord>('StripeEvent', stripeEventSchema);
