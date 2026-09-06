/**
 * Delivery, in one place.
 *
 * Everything the app tells a person about goes through `deliver`: the automatic
 * fan-out when a mosque publishes a post, and a coordinator writing to their
 * followers directly. Two things happen per send, in this order and never one
 * without the other:
 *
 *   1. an inbox row per recipient — the record, which survives a dead phone,
 *      a denied permission and a reinstall;
 *   2. a push to whichever of those recipients has a usable token — the
 *      interruption, which is best-effort by nature.
 *
 * That ordering is the whole design. Push was the only channel before, so a
 * volunteer who never granted notification permission was simply never told
 * anything; the bell on the home screen is the fix, and it can only be right if
 * the row is written whether or not Expo is reachable.
 */

import type {
  AppNotification,
  BroadcastInput,
  BroadcastResult,
  NotificationFeed,
  NotificationKind,
} from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { NotificationModel } from '../models/Notification.js';
import type { MosqueDocument } from '../models/Mosque.js';
import { UserModel, type UserDocument } from '../models/User.js';
import { newId } from '../utils/ids.js';
import { asContract } from '../utils/serialize.js';
import { sendExpoPush } from './push.service.js';

/**
 * How far back the inbox goes in one call.
 *
 * The list is not paginated: nobody scrolls a notification list past a screen
 * or two, and a cursor the app never uses is a cursor that rots. The unread
 * count is computed over everything, not over this page, so the badge stays
 * right even in the unlikely case that it does overflow.
 */
const INBOX_LIMIT = 50;

export interface DeliveryInput {
  mosqueId: string;
  /**
   * The mosque's name, for the push banner only — it is never written to the
   * row. The inbox resolves the name from `mosqueId` the same way the feed
   * resolves a post's mosque, so a mosque that renames itself doesn't leave a
   * stale name sitting in everyone's history.
   */
  mosqueName: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Set for a post fan-out; tapping either channel then opens that post. */
  postId?: string;
}

export interface DeliveryResult {
  /** Inbox rows written — one per recipient. */
  recipients: number;
  /** Of those, the ones a push was accepted for. */
  pushed: number;
}

/**
 * Write the inbox rows and fire the push.
 *
 * `recipients` are already filtered by the caller: who follows the mosque, and
 * whose preferences allow this kind of message. Nothing in here second-guesses
 * that — this function only decides *how* to reach the people it is handed.
 */
export async function deliver(
  recipients: UserDocument[],
  input: DeliveryInput,
): Promise<DeliveryResult> {
  if (recipients.length === 0) return { recipients: 0, pushed: 0 };

  const createdAt = new Date();
  await NotificationModel.insertMany(
    recipients.map((user) => ({
      _id: newId(),
      userId: user._id,
      mosqueId: input.mosqueId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      ...(input.postId ? { postId: input.postId } : {}),
      createdAt,
    })),
  );

  // The banner reads "Centre Islamique Khadija / Iftar setup" — who is talking,
  // then what about. The full text is one tap away in the inbox, so the body
  // here is the headline rather than the paragraph.
  const pushed = await sendExpoPush(
    recipients.map((u) => u.pushToken),
    {
      title: input.mosqueName,
      body: input.title,
      // `usePushSetup` opens post/[id] when a notification carrying this is
      // tapped. A mosque broadcast has no post, so it carries nothing and the
      // tap just brings the app forward.
      ...(input.postId ? { data: { postId: input.postId } } : {}),
    },
  );

  return { recipients: recipients.length, pushed };
}

/**
 * A coordinator writing to everyone who follows their mosque.
 *
 * The audience is followers with `announcements` on, minus the sender — the
 * same preference that gates an announcement post, because from the reader's
 * side this is the same thing: the mosque saying something. It is deliberately
 * *not* filtered by interests. Interests say which categories of activity
 * someone wants to hear about; a message written by hand to the whole
 * congregation has no category to match against.
 */
export async function broadcastToFollowers(
  mosque: MosqueDocument,
  senderId: string,
  input: BroadcastInput,
): Promise<BroadcastResult> {
  const follows = await FollowModel.find({ mosqueId: mosque._id });
  const followerIds = follows.map((f) => f.userId);
  if (followerIds.length === 0) return { recipients: 0, pushed: 0 };

  const recipients = await UserModel.find({
    // Both id conditions in one object — two `_id` keys in a literal would
    // silently drop the first.
    _id: { $in: followerIds, $ne: senderId },
    'notificationPrefs.announcements': true,
  });

  return deliver(recipients, {
    mosqueId: mosque._id,
    mosqueName: mosque.name,
    kind: 'mosque',
    title: input.title,
    body: input.body,
  });
}

/** The inbox: the most recent rows, plus the unread count over all of them. */
export async function buildFeed(userId: string): Promise<NotificationFeed> {
  const [rows, unread] = await Promise.all([
    NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(INBOX_LIMIT),
    NotificationModel.countDocuments({ userId, readAt: { $exists: false } }),
  ]);

  return { items: rows.map((row) => asContract<AppNotification>(row)), unread };
}

/**
 * Mark everything unread as read, then hand back the feed.
 *
 * Opening the inbox is the read receipt — there is no per-row tap to track,
 * because the list shows the whole message and there is nothing left to open.
 * Returning the feed rather than a count means the screen and the badge cannot
 * disagree about what just happened.
 */
export async function markAllRead(userId: string): Promise<NotificationFeed> {
  await NotificationModel.updateMany(
    { userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return buildFeed(userId);
}
