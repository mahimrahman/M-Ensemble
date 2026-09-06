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
    timezone: { type: String, default: 'America/Toronto' },
  },
  contractJson(['timezone']),
);

export type MosqueDocument = HydratedDocument<MosqueRecord>;
export const MosqueModel = model<MosqueRecord>('Mosque', mosqueSchema);
