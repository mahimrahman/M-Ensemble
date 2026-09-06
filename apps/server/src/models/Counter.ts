import { Schema, model, type HydratedDocument } from 'mongoose';

/**
 * Sequence numbers for the things a human reads aloud: `INV-2026-0042`,
 * `TKT-1043`.
 *
 * A UUID is right for an `_id` and useless as a reference — nobody reads one
 * over the phone. These have to be short, ordered and unique, which a client
 * cannot generate safely: two invoices minted in the same millisecond would
 * collide. `next()` is a single `findOneAndUpdate` with `$inc`, which Mongo
 * applies atomically, so concurrent callers get distinct numbers.
 *
 * Keyed per sequence and per year (`invoice:2026`) so the count restarts each
 * January without a migration.
 */
export interface CounterRecord {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterRecord>(
  { _id: { type: String, required: true }, seq: { type: Number, required: true, default: 0 } },
  { versionKey: false },
);

export type CounterDocument = HydratedDocument<CounterRecord>;
export const CounterModel = model<CounterRecord>('Counter', counterSchema);

/**
 * The next value in a sequence, atomically. Never returns the same number
 * twice, including across concurrent requests and across processes.
 */
export async function nextSequence(key: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}
