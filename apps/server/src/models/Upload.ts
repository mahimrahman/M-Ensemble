import { Schema, model, type HydratedDocument } from 'mongoose';
import { contractJson } from '../utils/serialize.js';

/**
 * One row per image that made it through `storePoster`.
 *
 * It exists for the quota — "how many has this person uploaded today" is a
 * count over this collection — and as the only ledger of what is in the
 * bucket. Without it an object storage bill is a number with no owner: a
 * compromised coordinator account could fill the bucket and nobody could say
 * from which account or when. Nothing in the mobile contract reads it.
 *
 * The URL is stored as minted (relative on local disk, absolute on S3) so a
 * later clean-up job can delete exactly what was written.
 */
export interface UploadRecord {
  _id: string;
  userId: string;
  url: string;
  bytes: number;
  width: number;
  height: number;
  createdAt: Date;
}

const uploadSchema = new Schema<UploadRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    url: { type: String, required: true },
    bytes: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

// The quota query: this user's uploads since 24 hours ago.
uploadSchema.index({ userId: 1, createdAt: -1 });

export type UploadDocument = HydratedDocument<UploadRecord>;
export const UploadModel = model<UploadRecord>('Upload', uploadSchema);
