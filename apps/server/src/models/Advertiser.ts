import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Advertiser } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * A partner buying placement — the restaurant, the modest-wear brand, the
 * driving school. Deliberately its own collection rather than a flag on
 * `Mosque`: a mosque's posts are free and carry the mosque's trust, and an
 * advertiser must never be able to inherit either.
 */
export interface AdvertiserRecord extends Omit<Advertiser, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

const advertiserSchema = new Schema<AdvertiserRecord>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, default: 'Other' },
    contactName: { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    website: { type: String, trim: true },
    logoUrl: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['active', 'paused', 'archived'],
      default: 'active',
    },
    note: { type: String },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  contractJson(),
);

advertiserSchema.index({ status: 1 });
// The advertiser table's search box is a prefix match on the name.
advertiserSchema.index({ name: 1 });

export type AdvertiserDocument = HydratedDocument<AdvertiserRecord>;
export const AdvertiserModel = model<AdvertiserRecord>('Advertiser', advertiserSchema);
