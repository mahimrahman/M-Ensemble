import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Invoice } from '@m-ensemble/shared';
import { SUBDOCUMENT, contractJson } from '../utils/serialize.js';

/**
 * A bill, against a mosque (subscription) or an advertiser (campaign).
 *
 * `paidCents` and `dueCents` are stored rather than derived on read. That is a
 * denormalisation with a reason: the invoice list is the screen someone stares
 * at while chasing money, and summing a payments collection per row would make
 * it an N+1. `recordPayment` is the only writer of both, so they cannot drift
 * without going through one function.
 *
 * `lines[].amountCents` is likewise stored — a plan's price changing next year
 * must not silently rewrite what a mosque was billed last year.
 */
export interface InvoiceRecord extends Omit<
  Invoice,
  'issuedAt' | 'dueAt' | 'paidAt' | 'voidedAt' | 'createdAt' | 'updatedAt'
> {
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  voidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCents: { type: Number, required: true },
    amountCents: { type: Number, required: true },
  },
  SUBDOCUMENT,
);

const invoiceSchema = new Schema<InvoiceRecord>(
  {
    _id: { type: String, required: true },
    number: { type: String, required: true, unique: true },
    kind: {
      type: String,
      required: true,
      enum: ['subscription', 'campaign', 'donation_fee', 'other'],
    },
    mosqueId: { type: String },
    advertiserId: { type: String },
    sourceId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
      default: 'draft',
    },
    currency: { type: String, required: true, default: 'CAD' },
    lines: { type: [lineSchema], required: true },
    subtotalCents: { type: Number, required: true },
    taxCents: { type: Number, required: true, default: 0 },
    totalCents: { type: Number, required: true },
    paidCents: { type: Number, required: true, default: 0 },
    dueCents: { type: Number, required: true },
    issuedAt: { type: Date, required: true },
    dueAt: { type: Date, required: true },
    paidAt: { type: Date },
    voidedAt: { type: Date },
    note: { type: String },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  contractJson(),
);

// "What is outstanding, oldest first" is the query the billing screen opens on.
invoiceSchema.index({ status: 1, dueAt: 1 });
invoiceSchema.index({ mosqueId: 1, issuedAt: -1 });
invoiceSchema.index({ advertiserId: 1, issuedAt: -1 });

export type InvoiceDocument = HydratedDocument<InvoiceRecord>;
export const InvoiceModel = model<InvoiceRecord>('Invoice', invoiceSchema);
