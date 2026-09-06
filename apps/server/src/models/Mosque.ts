import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Mosque } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * `timezone` is server-only and not in the contract. It is stored but never
 * read today: `buildPrayerTable` writes `MOSQUE_TIMEZONE` into every
 * `PrayerTable` unconditionally, which keeps the endpoint byte-identical to the
 * mock. Every demo mosque is America/Toronto — phase-5's honesty slide says so.
 */
export interface MosqueRecord extends Mosque {
  timezone: string;
  /** Set by super-admin provisioning; absent on seeded and directory rows. */
  createdAt?: Date;
}

const mosqueSchema = new Schema<MosqueRecord>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    joinCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    prayerConfig: {
      calculationMethod: { type: String, required: true },
      madhab: { type: String, required: true, enum: ['shafi', 'hanafi'] },
      highLatitudeRule: { type: String, required: true },
    },
    // The profile the mosque writes about itself. All optional: a mosque that
    // has told us nothing but its address still renders.
    bio: { type: String },
    website: { type: String, trim: true },
    phone: { type: String, trim: true },
    history: { type: String },
    rating: {
      score: { type: Number },
      count: { type: Number },
    },
    services: { type: [String], default: undefined },
    timezone: { type: String, default: 'America/Toronto' },
    // When we onboarded them. Server-only like `timezone`, and absent on the
    // directory rows, which we never onboarded at all.
    createdAt: { type: Date },
  },
  contractJson(['timezone', 'createdAt']),
);

export type MosqueDocument = HydratedDocument<MosqueRecord>;
export const MosqueModel = model<MosqueRecord>('Mosque', mosqueSchema);
