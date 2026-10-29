import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Mosque } from '@m-ensemble/shared';
import { SUBDOCUMENT, contractJson } from '../utils/serialize.js';

/**
 * `timezone` is server-only and not in the contract. It is stored but never
 * read today: `buildPrayerTable` writes `MOSQUE_TIMEZONE` into every
 * `PrayerTable` unconditionally, which keeps the endpoint byte-identical to the
 * mock. Every demo mosque is America/Toronto — phase-5's honesty slide says so.
 *
 * The Stripe Connect fields are server-only too. The app learns one boolean,
 * `donationsEnabled`, computed on the way out; the account id and the
 * requirement list are the operator's business and go to the console through
 * `MosqueDetail.payouts` instead.
 */
export interface MosquePayouts {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  updatedAt: Date;
}

export interface MosqueRecord extends Omit<Mosque, 'donationsEnabled'> {
  timezone: string;
  /** Set by super-admin provisioning; absent on seeded and directory rows. */
  createdAt?: Date;
  /** The Express account donations are transferred to. Set at onboarding. */
  stripeAccountId?: string;
  /** Mirror of the account's capability flags, from the webhook and on demand. */
  payouts?: MosquePayouts;
}

const payoutsSchema = new Schema<MosquePayouts>(
  {
    chargesEnabled: { type: Boolean, required: true, default: false },
    payoutsEnabled: { type: Boolean, required: true, default: false },
    detailsSubmitted: { type: Boolean, required: true, default: false },
    requirementsDue: { type: [String], required: true, default: [] },
    updatedAt: { type: Date, required: true },
  },
  SUBDOCUMENT,
);

const json = contractJson(['timezone', 'createdAt', 'stripeAccountId', 'payouts']);

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
    // One optional string per platform, each a full https URL. Spelled out
    // rather than a free Map so an unknown key is dropped on write instead of
    // reaching the app as a platform nothing knows how to draw.
    social: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      youtube: { type: String, trim: true },
      tiktok: { type: String, trim: true },
      x: { type: String, trim: true },
      whatsapp: { type: String, trim: true },
      telegram: { type: String, trim: true },
    },
    timezone: { type: String, default: 'America/Toronto' },
    // When we onboarded them. Server-only like `timezone`, and absent on the
    // directory rows, which we never onboarded at all.
    createdAt: { type: Date },
    stripeAccountId: { type: String },
    payouts: { type: payoutsSchema },
  },
  {
    ...json,
    toJSON: {
      ...json.toJSON,
      transform(doc: unknown, ret: Record<string, unknown>) {
        // Read before the base transform strips `payouts`. Always emitted, so
        // the app can branch on a boolean rather than on a missing key.
        const payouts = ret.payouts as MosquePayouts | undefined;
        const out = json.toJSON.transform(doc, ret);
        out.donationsEnabled = Boolean(payouts?.chargesEnabled);
        return out;
      },
    },
  },
);

// The webhook finds the mosque by the account that changed.
mosqueSchema.index({ stripeAccountId: 1 });

export type MosqueDocument = HydratedDocument<MosqueRecord>;
export const MosqueModel = model<MosqueRecord>('Mosque', mosqueSchema);
