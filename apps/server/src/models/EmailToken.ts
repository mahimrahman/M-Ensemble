import { Schema, model, type HydratedDocument } from 'mongoose';

export type EmailTokenKind = 'reset' | 'verify';

/**
 * A single-use secret we mailed to someone: a password reset or an address
 * confirmation.
 *
 * Only the SHA-256 of the token is stored. The raw value lives in exactly one
 * place — the email — so a copy of this collection is worth nothing to whoever
 * takes it. `usedAt` is set rather than the row deleted, which lets support
 * see that a reset happened; the TTL index clears both used and unused rows
 * once they are past `expiresAt`.
 */
export interface EmailTokenRecord {
  _id: string;
  userId: string;
  kind: EmailTokenKind;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}

const emailTokenSchema = new Schema<EmailTokenRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    kind: { type: String, required: true, enum: ['reset', 'verify'] },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { versionKey: false },
);

emailTokenSchema.index({ tokenHash: 1 }, { unique: true });
emailTokenSchema.index({ userId: 1, kind: 1 });
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailTokenDocument = HydratedDocument<EmailTokenRecord>;
export const EmailTokenModel = model<EmailTokenRecord>('EmailToken', emailTokenSchema);
