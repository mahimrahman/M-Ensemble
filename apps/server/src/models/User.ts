import { Schema, model, type HydratedDocument } from 'mongoose';
import type { NotificationPrefs, User } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * Server-side user. Two fields never cross the wire: `passwordHash` and
 * `notificationPrefs` (the latter has its own endpoint). What `toJSON` emits is
 * exactly the contract's `User`: `{ _id, name, email, interests, pushToken? }`.
 */
export interface UserRecord extends User {
  passwordHash: string;
  notificationPrefs: NotificationPrefs;
}

const userSchema = new Schema<UserRecord>(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    interests: { type: [String], default: [] },
    pushToken: { type: String },
    // Nested plain object, not a sub-Schema: a sub-Schema would carry its own _id.
    notificationPrefs: {
      volunteerRequests: { type: Boolean, default: true },
      events: { type: Boolean, default: true },
      classes: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      prayerReminders: { type: Boolean, default: false },
    },
  },
  contractJson(['passwordHash', 'notificationPrefs']),
);

export type UserDocument = HydratedDocument<UserRecord>;
export const UserModel = model<UserRecord>('User', userSchema);
