import { Schema, model, type HydratedDocument } from 'mongoose';
import type { AuditEntry } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * Append-only record of every write a platform operator makes.
 *
 * It exists because the super admin can change anything — issue credentials,
 * void an invoice, suspend an account — and an action that powerful with no
 * record of who took it is one the team cannot investigate afterwards.
 *
 * There is deliberately **no update or delete path** to this collection: the
 * service exposes `record` and nothing else, and the API exposes a read.
 */
export interface AuditEntryRecord extends Omit<AuditEntry, 'createdAt'> {
  createdAt: Date;
}

const auditSchema = new Schema<AuditEntryRecord>(
  {
    _id: { type: String, required: true },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    targetType: {
      type: String,
      required: true,
      enum: [
        'mosque',
        'user',
        'invoice',
        'subscription',
        'campaign',
        'advertiser',
        'ticket',
        'donation',
        'post',
      ],
    },
    targetId: { type: String, required: true },
    summary: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
    ip: { type: String },
    createdAt: { type: Date, required: true },
  },
  contractJson(),
);

// The log is read newest-first, and filtered by actor or by what was touched.
auditSchema.index({ createdAt: -1 });
auditSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditSchema.index({ actorId: 1, createdAt: -1 });

export type AuditEntryDocument = HydratedDocument<AuditEntryRecord>;
export const AuditEntryModel = model<AuditEntryRecord>('AuditEntry', auditSchema);
