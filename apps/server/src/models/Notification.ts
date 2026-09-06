import { Schema, model, type HydratedDocument } from 'mongoose';
import type { AppNotification } from '@m-ensemble/shared';
import { contractJson } from '../utils/serialize.js';

/**
 * One row per recipient, not one per send.
 *
 * `readAt` is a property of the person, not the message: a shared row would let
 * one reader's tap clear the badge for the whole congregation. The cost is a
 * write per follower, which is a few hundred rows at the scale this runs at and
 * lets the inbox be a single indexed query.
 *
 * Nothing here is a second source of truth — a notification is a record that
 * something was *sent*, which no other collection holds. Deleting the post it
 * points at leaves the line in the inbox; tapping it then 404s the same way a
 * stale deep link does, which is honest.
 */
export interface NotificationRecord extends Omit<AppNotification, 'createdAt' | 'readAt'> {
  createdAt: Date;
  readAt?: Date;
}

const notificationSchema = new Schema<NotificationRecord>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    mosqueId: { type: String, required: true },
    kind: { type: String, required: true, enum: ['post', 'mosque'] },
    title: { type: String, required: true },
    body: { type: String, required: true },
    postId: { type: String },
    createdAt: { type: Date, required: true },
    readAt: { type: Date },
  },
  contractJson(),
);

// The inbox query, exactly: everything for one user, newest first.
notificationSchema.index({ userId: 1, createdAt: -1 });
// The badge: unread rows for one user. `readAt` is sparse in practice, so this
// stays small next to the index above.
notificationSchema.index({ userId: 1, readAt: 1 });

export type NotificationDocument = HydratedDocument<NotificationRecord>;
export const NotificationModel = model<NotificationRecord>('Notification', notificationSchema);
