/** Barrel for the seed script and the test harness, which touch all ten. */

export { UserModel, type UserDocument, type UserRecord } from './User.js';
export { MosqueModel, type MosqueDocument, type MosqueRecord } from './Mosque.js';
export { FollowModel, type FollowDocument, type FollowRecord } from './Follow.js';
export { LikeModel, type LikeDocument, type LikeRecord } from './Like.js';
export { MembershipModel, type MembershipDocument, type MembershipRecord } from './Membership.js';
export { PostModel, type PostDocument, type PostRecord } from './Post.js';
export { SignupModel, type SignupDocument, type SignupRecord } from './Signup.js';
export { IqamahConfigModel, type IqamahConfigDocument } from './IqamahConfig.js';
export { JummahSessionModel, type JummahSessionDocument } from './JummahSession.js';
export {
  NotificationModel,
  type NotificationDocument,
  type NotificationRecord,
} from './Notification.js';

import type { Model } from 'mongoose';
import { UserModel } from './User.js';
import { MosqueModel } from './Mosque.js';
import { FollowModel } from './Follow.js';
import { LikeModel } from './Like.js';
import { MembershipModel } from './Membership.js';
import { PostModel } from './Post.js';
import { SignupModel } from './Signup.js';
import { IqamahConfigModel } from './IqamahConfig.js';
import { JummahSessionModel } from './JummahSession.js';
import { NotificationModel } from './Notification.js';

/**
 * Every collection, in seed/clear order — used by the seed script and the test
 * harness to wipe and reindex the database.
 *
 * `Model<any>` rather than a union: Mongoose's `Model<T>` is invariant in `T`,
 * so a union of the ten has no `deleteMany` signature the compiler will call.
 * Nothing here reads a document; it only calls collection-level operations.
 */
export const ALL_MODELS: Model<any>[] = [
  UserModel,
  MosqueModel,
  FollowModel,
  LikeModel,
  MembershipModel,
  PostModel,
  SignupModel,
  IqamahConfigModel,
  JummahSessionModel,
  NotificationModel,
];
