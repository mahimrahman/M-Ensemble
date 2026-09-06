import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Payment } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * Money that actually arrived against an invoice.
 *
 * Append-only by convention: a payment recorded in error is corrected with a
 * negative row, never edited away. Cash that was reconciled once and then
 * quietly changed is exactly the kind of thing an audit is meant to catch.
 *
 * **No processor writes these yet.** Every row today is hand-entered by a
 * super admin, which is why `recordedBy` is required rather than optional.
 */
export interface PaymentRecord extends Omit<Payment, 'receivedAt' | 'createdAt'> {
  receivedAt: Date;
  createdAt: Date;
}

const paymentSchema = new Schema<PaymentRecord>(
  {
    _id: { type: String, required: true },
    invoiceId: { type: String, required: true },
    amountCents: { type: Number, required: true },
    currency: { type: String, required: true, default: 'CAD' },
    method: {
      type: String,
      required: true,
      enum: ['manual', 'etransfer', 'cheque', 'cash', 'card', 'other'],
      default: 'manual',
    },
    reference: { type: String },
    receivedAt: { type: Date, required: true },
    recordedBy: { type: String, required: true },
    note: { type: String },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

// The two ways payments are read: by invoice, and as a cash-in time series.
paymentSchema.index({ invoiceId: 1 });
paymentSchema.index({ receivedAt: -1 });

export type PaymentDocument = HydratedDocument<PaymentRecord>;
export const PaymentModel = model<PaymentRecord>('Payment', paymentSchema);
