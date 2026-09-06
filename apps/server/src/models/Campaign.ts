import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Campaign } from '@m-ensemble/shared';
import { SUBDOCUMENT, contractJson } from '../utils/serialize.js';

/**
 * One flight of one advertiser's creative.
 *
 * `impressions`, `clicks` and `spentCents` are denormalised counters kept in
 * step by `$inc` from the delivery endpoints — the per-day `CampaignStat` rows
 * are the audit trail, and a disagreement between the two is resolved in
 * favour of the rows. They live on the document because the campaign table
 * shows them on every row, and an aggregation per row would be an N+1 on the
 * one screen a salesperson refreshes all day.
 */
export interface CampaignRecord extends Omit<
  Campaign,
  'startAt' | 'endAt' | 'approvedAt' | 'createdAt' | 'updatedAt'
> {
  startAt: Date;
  endAt: Date;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const creativeSchema = new Schema(
  {
    headline: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    imageUrl: { type: String },
    ctaLabel: { type: String, required: true, trim: true },
    ctaUrl: { type: String, required: true, trim: true },
    disclosure: { type: String, trim: true },
  },
  SUBDOCUMENT,
);

const targetingSchema = new Schema(
  {
    cities: { type: [String], default: [] },
    mosqueIds: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    placements: { type: [String], default: ['feed'] },
  },
  SUBDOCUMENT,
);

const campaignSchema = new Schema<CampaignRecord>(
  {
    _id: { type: String, required: true },
    advertiserId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['draft', 'pending', 'active', 'paused', 'completed', 'rejected'],
      default: 'draft',
    },
    creative: { type: creativeSchema, required: true },
    targeting: { type: targetingSchema, required: true, default: () => ({}) },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    budgetCents: { type: Number, required: true, min: 0 },
    pricing: { type: String, required: true, enum: ['flat', 'cpm', 'cpc'], default: 'flat' },
    rateCents: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, required: true, default: 'CAD' },
    impressions: { type: Number, required: true, default: 0, min: 0 },
    clicks: { type: Number, required: true, default: 0, min: 0 },
    spentCents: { type: Number, required: true, default: 0, min: 0 },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  contractJson(),
);

/**
 * The delivery query is `status: 'active'` plus a date window plus targeting,
 * and it runs on every feed load in the app. This index is what keeps that off
 * a collection scan; the targeting arrays are filtered in memory afterwards,
 * because the candidate set after this index is a handful of rows.
 */
campaignSchema.index({ status: 1, startAt: 1, endAt: 1 });
campaignSchema.index({ advertiserId: 1 });

export type CampaignDocument = HydratedDocument<CampaignRecord>;
export const CampaignModel = model<CampaignRecord>('Campaign', campaignSchema);
