import { Schema, model, type HydratedDocument } from 'mongoose';

/**
 * One row per signed-out token, keyed by its `jti`.
 *
 * JWTs cannot be recalled, so sign-out has to be a denylist. It stays small
 * because a row only needs to live as long as the token it names: `expiresAt`
 * is copied from the token's `exp` and Mongo's TTL monitor sweeps it after
 * that. Bulk revocation (password change, deletion) does not go through here
 * at all — it bumps `User.tokenVersion` instead, which costs nothing per token.
 */
export interface RevokedTokenRecord {
  _id: string;
  userId: string;
  expiresAt: Date;
}

const revokedTokenSchema = new Schema<RevokedTokenRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RevokedTokenDocument = HydratedDocument<RevokedTokenRecord>;
export const RevokedTokenModel = model<RevokedTokenRecord>('RevokedToken', revokedTokenSchema);
