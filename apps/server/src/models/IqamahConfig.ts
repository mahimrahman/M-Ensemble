import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Iqamah } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * `fixedTime` and `effectiveFrom` are wall-clock/calendar strings and are never
 * converted — a UTC iqamah shifts every mosque by an hour twice a year.
 *
 * `_id` is stripped on the way out. The contract's `Iqamah` has none, and the
 * iqamah editor rebuilds its PUT body from the rows this endpoint returned,
 * stripping only `mosqueId` — so any extra key we emit gets posted straight
 * back at us.
 */
export interface IqamahRecord extends Iqamah {
  _id: string;
}

const iqamahSchema = new Schema<IqamahRecord>(
  {
    _id: { type: String, required: true },
    mosqueId: { type: String, required: true },
    prayer: {
      type: String,
      required: true,
      enum: ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'],
    },
    mode: { type: String, required: true, enum: ['fixed', 'offset'] },
    fixedTime: { type: String },
    offsetMinutes: { type: Number },
    effectiveFrom: { type: String, required: true },
  },
  contractJson(['_id']),
);

iqamahSchema.index({ mosqueId: 1, prayer: 1, effectiveFrom: 1 });

export type IqamahConfigDocument = HydratedDocument<IqamahRecord>;
export const IqamahConfigModel = model<IqamahRecord>('IqamahConfig', iqamahSchema);
