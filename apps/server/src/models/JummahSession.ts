import { Schema, model, type HydratedDocument } from 'mongoose';
import type { JummahSession } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/** Like `IqamahConfig`: wall-clock strings, and no `_id` on the wire. */
export interface JummahSessionRecord extends JummahSession {
  _id: string;
}

const jummahSchema = new Schema<JummahSessionRecord>(
  {
    _id: { type: String, required: true },
    mosqueId: { type: String, required: true },
    label: { type: String, required: true },
    khutbahTime: { type: String, required: true },
    iqamahTime: { type: String, required: true },
  },
  contractJson(['_id']),
);

jummahSchema.index({ mosqueId: 1 });

export type JummahSessionDocument = HydratedDocument<JummahSessionRecord>;
export const JummahSessionModel = model<JummahSessionRecord>('JummahSession', jummahSchema);
