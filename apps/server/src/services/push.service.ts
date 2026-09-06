import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import type { PostType } from '@m-ensemble/shared';
import { env } from '../config/env.js';
import { FollowModel } from '../models/Follow.js';
import { MosqueModel } from '../models/Mosque.js';
import { UserModel } from '../models/User.js';
import type { PostDocument } from '../models/Post.js';

/** Which notification preference gates which kind of post. */
const PREF_BY_TYPE: Record<PostType, string> = {
  volunteer: 'volunteerRequests',
  event: 'events',
  class: 'classes',
  announcement: 'announcements',
};

const expo = new Expo(
  env.EXPO_ACCESS_TOKEN ? { accessToken: env.EXPO_ACCESS_TOKEN } : undefined,
);

/**
 * Tell the right people a post exists.
 *
 * Recipients follow the mosque, list the post's category among their interests,
 * have registered a push token, and have the matching notification preference
 * on. The creator is excluded — a coordinator doesn't need to be told about
 * their own shift.
 *
 * Categories are the English keys from `INTEREST_OPTIONS` and never get
 * translated on the wire, which is what makes this a plain equality match.
 *
 * Called after the 201 has gone out, so every failure in here is logged and
 * swallowed: a push that doesn't land must not turn into a failed post.
 */
export async function fanOutNewPost(post: PostDocument): Promise<void> {
  // Tests run with no network and no Expo credentials.
  if (env.NODE_ENV === 'test') return;

  const follows = await FollowModel.find({ mosqueId: post.mosqueId });
  const followerIds = follows.map((f) => f.userId);
  if (followerIds.length === 0) return;

  const recipients = await UserModel.find({
    // Both id conditions in one object — two `_id` keys in a literal would
    // silently drop the first.
    _id: { $in: followerIds, $ne: post.createdBy },
    interests: post.category,
    pushToken: { $exists: true, $ne: null },
    [`notificationPrefs.${PREF_BY_TYPE[post.type]}`]: true,
  });

  const tokens = recipients
    .map((u) => u.pushToken)
    .filter((token): token is string => !!token && Expo.isExpoPushToken(token));

  if (tokens.length === 0) return;

  const mosque = await MosqueModel.findById(post.mosqueId);

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title: mosque?.name ?? 'Your mosque',
    body: post.title,
    // `usePushToken` opens post/[id] when a notification carrying this is tapped.
    data: { postId: post._id },
  }));

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    const failed = tickets.filter((t) => t.status === 'error');
    console.log(`[push] sent ${chunk.length}, ${failed.length} rejected`);
    for (const ticket of failed) {
      console.error('[push] ticket error', ticket.message);
    }
  }
}
