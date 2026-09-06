import { Schema, model, type HydratedDocument } from 'mongoose';
import type { Signup } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * `createdAt` is optional and has no default — two fixture rows deliberately
 * omit it, and the admin home branches on its presence. It is also rewritten to
 * `now` when someone re-signs up after withdrawing, which Mongoose-managed
 * timestamps would not permit. Hence no `timestamps: true` here.
 */
export interface SignupRecord extends Omit<Signup, 'checkedInAt' | 'createdAt'> {
  checkedInAt?: Date;
  createdAt?: Date;
}

const signupSchema = new Schema<SignupRecord>(
  {
    _id: { type: String, required: true },
    postId: { type: String, required: true },
    userId: { type: String, required: true },
    status: { type: String, required: true, enum: ['confirmed', 'withdrawn'] },
    checkedInAt: { type: Date },
    createdAt: { type: Date },
  },
  contractJson(),
);

// The second guard on the slot race — the atomic $inc is the first.
signupSchema.index({ postId: 1, userId: 1 }, { unique: true });
signupSchema.index({ userId: 1, status: 1 });
signupSchema.index({ postId: 1, status: 1 });

export type SignupDocument = HydratedDocument<SignupRecord>;
export const SignupModel = model<SignupRecord>('Signup', signupSchema);
