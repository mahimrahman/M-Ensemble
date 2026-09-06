import { Schema, model, type HydratedDocument } from 'mongoose';
import type { NotificationPrefs, PlatformRole, User, UserStatus } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * Server-side user. What `toJSON` emits is exactly the contract's `User`:
 * `{ _id, name, email, interests, pushToken? }`.
 *
 * **Everything the platform tier added is stripped from `toJSON`.**
 * `passwordHash` and `notificationPrefs` were always held back; `platformRole`,
 * `status` and the timestamps join them. The mobile app's `User` shape is
 * locked, and a super admin's role is nobody else's business — the admin API
 * reads these fields off the document and builds `PlatformUser` by hand.
 */
export interface UserRecord extends User {
  passwordHash: string;
  notificationPrefs: NotificationPrefs;
  /** The tier above `Membership.role`. Not mosque-scoped, so it lives here. */
  platformRole: PlatformRole;
  /** `suspended` blocks sign-in and keeps every row the person created. */
  status: UserStatus;
  /** Set on an account the super admin provisioned rather than one that
   *  self-registered — the app nags until they pick their own password. */
  mustChangePassword?: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
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
    platformRole: {
      type: String,
      enum: ['none', 'support', 'superadmin'],
      default: 'none',
      required: true,
    },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
    mustChangePassword: { type: Boolean },
    createdAt: { type: Date, default: () => new Date(), required: true },
    lastLoginAt: { type: Date },
  },
  contractJson([
    'passwordHash',
    'notificationPrefs',
    'platformRole',
    'status',
    'mustChangePassword',
    'createdAt',
    'lastLoginAt',
  ]),
);

// The super-admin user table filters on both of these, and the sign-in path
// checks `status` on every request that reaches `requireAuth`.
userSchema.index({ platformRole: 1 });
userSchema.index({ status: 1 });

export type UserDocument = HydratedDocument<UserRecord>;
export const UserModel = model<UserRecord>('User', userSchema);
