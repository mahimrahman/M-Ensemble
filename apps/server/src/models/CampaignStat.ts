import { Schema, model, type HydratedDocument } from 'mongoose';
import type { CampaignStat } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * One campaign's activity on one day — the rollup behind every chart, and the
 * audit trail the counters on `Campaign` are checked against.
 *
 * A row per impression would be the obvious shape and the wrong one: a feed
 * load writes one, so at any real volume that is the largest collection in the
 * database and nobody ever reads an individual row. A day is the smallest
 * window anyone reports on, so a day is the row.
 *
 * `_id` is `<campaignId>:<date>` so the write is a pure upsert with no read
 * first, and two concurrent impressions cannot mint two rows for the same day.
 */
export interface CampaignStatRecord extends CampaignStat {
  _id: string;
}

const campaignStatSchema = new Schema<CampaignStatRecord>(
  {
    _id: { type: String, required: true },
    campaignId: { type: String, required: true },
    date: { type: String, required: true },
    impressions: { type: Number, required: true, default: 0 },
    clicks: { type: Number, required: true, default: 0 },
    spentCents: { type: Number, required: true, default: 0 },
  },
  contractJson(['_id']),
);

campaignStatSchema.index({ campaignId: 1, date: 1 });

export type CampaignStatDocument = HydratedDocument<CampaignStatRecord>;
export const CampaignStatModel = model<CampaignStatRecord>('CampaignStat', campaignStatSchema);
