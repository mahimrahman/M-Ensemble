/** Barrel for the seed script and the test harness, which touch all of them. */

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

// ─── The platform tier ──────────────────────────────────────────────────────
// Everything the super admin operates. Separate from the ten above because
// nothing in the mobile app reads any of it.

export {
  SubscriptionModel,
  type SubscriptionDocument,
  type SubscriptionRecord,
} from './Subscription.js';
export { InvoiceModel, type InvoiceDocument, type InvoiceRecord } from './Invoice.js';
export { PaymentModel, type PaymentDocument, type PaymentRecord } from './Payment.js';
export { DonationModel, type DonationDocument, type DonationRecord } from './Donation.js';
export { AdvertiserModel, type AdvertiserDocument, type AdvertiserRecord } from './Advertiser.js';
export { CampaignModel, type CampaignDocument, type CampaignRecord } from './Campaign.js';
export {
  CampaignStatModel,
  type CampaignStatDocument,
  type CampaignStatRecord,
} from './CampaignStat.js';
export {
  SupportTicketModel,
  type SupportTicketDocument,
  type SupportTicketRecord,
} from './SupportTicket.js';
export { AuditEntryModel, type AuditEntryDocument, type AuditEntryRecord } from './AuditEntry.js';
export { CounterModel, nextSequence, type CounterDocument, type CounterRecord } from './Counter.js';

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
import { SubscriptionModel } from './Subscription.js';
import { InvoiceModel } from './Invoice.js';
import { PaymentModel } from './Payment.js';
import { DonationModel } from './Donation.js';
import { AdvertiserModel } from './Advertiser.js';
import { CampaignModel } from './Campaign.js';
import { CampaignStatModel } from './CampaignStat.js';
import { SupportTicketModel } from './SupportTicket.js';
import { AuditEntryModel } from './AuditEntry.js';
import { CounterModel } from './Counter.js';

/**
 * Every collection, in seed/clear order — used by the seed script and the test
 * harness to wipe and reindex the database.
 *
 * `Model<any>` rather than a union: Mongoose's `Model<T>` is invariant in `T`,
 * so a union of them has no `deleteMany` signature the compiler will call.
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
  SubscriptionModel,
  InvoiceModel,
  PaymentModel,
  DonationModel,
  AdvertiserModel,
  CampaignModel,
  CampaignStatModel,
  SupportTicketModel,
  AuditEntryModel,
  CounterModel,
];
