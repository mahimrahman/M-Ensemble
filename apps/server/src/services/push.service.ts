import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { PostType } from '@m-ensemble/shared';
import { env } from '../config/env.js';
import { FollowModel } from '../models/Follow.js';
import { MosqueModel } from '../models/Mosque.js';
import { UserModel } from '../models/User.js';
import type { PostDocument } from '../models/Post.js';
import { deliver } from './notification.service.js';

/** Which notification preference gates which kind of post. */
const PREF_BY_TYPE: Record<PostType, string> = {
  volunteer: 'volunteerRequests',
  event: 'events',
  class: 'classes',
  announcement: 'announcements',
};

const expo = new Expo(env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : undefined);

export interface PushContent {
  title: string;
  body: string;
  /** Rides along to the app; `{ postId }` is what the tap handler reads. */
  data?: Record<string, unknown>;
}

/**
 * Push a message to a list of tokens. Resolves to how many Expo accepted.
 *
 * Anything that isn't a real Expo token is dropped rather than sent — a user
 * with no token, or one stored before `pushTokenSchema` started validating.
 * Every failure is logged and swallowed: a push that doesn't land must never
 * fail the thing that caused it.
 *
 * Returns 0 without touching the network under `NODE_ENV=test`, so the tests
 * still exercise the inbox half of a delivery with no Expo credentials.
 */
export async function sendExpoPush(
  tokens: (string | undefined)[],
  content: PushContent,
): Promise<number> {
  const usable = tokens.filter((token): token is string => !!token && Expo.isExpoPushToken(token));
  if (usable.length === 0) return 0;
  if (env.NODE_ENV === 'test') return 0;

  const messages: ExpoPushMessage[] = usable.map((to) => ({
    to,
    sound: 'default',
    title: content.title,
    body: content.body,
    ...(content.data ? { data: content.data } : {}),
  }));

  let accepted = 0;
  try {
    for (const chunk of expo.chunkPushNotifications(messages)) {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      const failed = tickets.filter((t) => t.status === 'error');
      accepted += chunk.length - failed.length;
      console.log(`[push] sent ${chunk.length}, ${failed.length} rejected`);
      for (const ticket of failed) {
        console.error('[push] ticket error', ticket.message);
      }
    }
  } catch (err) {
    console.error('[push] send failed', err);
  }
  return accepted;
}

/**
 * Tell the right people a post exists.
 *
 * Recipients follow the mosque, list the post's category among their interests,
 * and have the matching notification preference on. The creator is excluded — a
 * coordinator doesn't need to be told about their own shift.
 *
 * A push token is deliberately **not** part of that filter any more. It used to
 * be, which meant somebody who declined the OS prompt was told nothing at all;
 * now everyone in the audience gets the inbox row and the push goes to whoever
 * can receive one.
 *
 * Categories are the English keys from `INTEREST_OPTIONS` and never get
 * translated on the wire, which is what makes this a plain equality match.
 *
 * Called after the 201 has gone out, so every failure in here is logged and
 * swallowed: a notification that doesn't land must not turn into a failed post.
 */
export async function fanOutNewPost(post: PostDocument): Promise<void> {
  const follows = await FollowModel.find({ mosqueId: post.mosqueId });
  const followerIds = follows.map((f) => f.userId);
  if (followerIds.length === 0) return;

  const recipients = await UserModel.find({
    // Both id conditions in one object — two `_id` keys in a literal would
    // silently drop the first.
    _id: { $in: followerIds, $ne: post.createdBy },
    interests: post.category,
    [`notificationPrefs.${PREF_BY_TYPE[post.type]}`]: true,
  });

  const mosque = await MosqueModel.findById(post.mosqueId);

  await deliver(recipients, {
    mosqueId: post.mosqueId,
    mosqueName: mosque?.name ?? 'Your mosque',
    kind: 'post',
    title: post.title,
    body: post.description,
    postId: post._id,
  });
}
