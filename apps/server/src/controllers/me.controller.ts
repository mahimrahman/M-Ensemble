import type { Request, Response } from 'express';
import type { NotificationPrefs, ServiceHours } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MembershipModel } from '../models/Membership.js';
import { MosqueModel } from '../models/Mosque.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { currentUser } from '../middleware/requireAuth.js';
import { buildFeed, markAllRead } from '../services/notification.service.js';
import { buildReliability } from '../services/reliability.service.js';
import { postMinutes } from '../utils/time.js';
import { ok, okNull } from '../utils/respond.js';

export async function getMe(req: Request, res: Response): Promise<void> {
  ok(res, currentUser(req).toJSON());
}

export async function patchMe(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const patch = req.body as Partial<{ name: string; interests: string[]; pushToken: string }>;

  if (patch.name !== undefined) user.name = patch.name;
  if (patch.interests !== undefined) user.interests = patch.interests;
  if (patch.pushToken !== undefined) user.pushToken = patch.pushToken;

  await user.save();
  ok(res, user.toJSON());
}

/** Mosques the user follows. Roles have nothing to do with it. */
export async function getMyMosques(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const follows = await FollowModel.find({ userId: user._id });
  const mosques = await MosqueModel.find({ _id: { $in: follows.map((f) => f.mosqueId) } });
  ok(
    res,
    mosques.map((m) => m.toJSON()),
  );
}

/**
 * Every role row for the user; `[]` for a plain member. Runs on every cold
 * start and after login, and decides which shell the session lands in — one
 * indexed lookup, nothing else.
 */
export async function getMyMemberships(req: Request, res: Response): Promise<void> {
  const memberships = await MembershipModel.find({ userId: currentUser(req)._id });
  ok(
    res,
    memberships.map((m) => m.toJSON()),
  );
}

/** Confirmed signups, all time. The app splits past from upcoming itself. */
export async function getMyCommitments(req: Request, res: Response): Promise<void> {
  const signups = await SignupModel.find({ userId: currentUser(req)._id, status: 'confirmed' });
  ok(
    res,
    signups.map((s) => s.toJSON()),
  );
}

/**
 * Service hours over every signup the user was checked in for — **any post
 * type**, unlike `MosqueMember.minutesServed` and the dashboard, which count
 * only `volunteer`. The mock does both and the app's copy is written around
 * both; unifying them is a contract change, not a bug fix.
 */
export async function getMyHours(req: Request, res: Response): Promise<void> {
  const served = await SignupModel.find({
    userId: currentUser(req)._id,
    checkedInAt: { $exists: true },
  });

  const posts = await PostModel.find({ _id: { $in: served.map((s) => s.postId) } });
  const byId = new Map(posts.map((p) => [p._id, p]));

  const totalMinutes = served.reduce((sum, signup) => {
    const post = byId.get(signup.postId);
    return post ? sum + postMinutes(post) : sum;
  }, 0);

  const hours: ServiceHours = { totalMinutes, shiftsCompleted: served.length };
  ok(res, hours);
}

/**
 * The volunteer`s own record. Same numbers the coordinator sees on the member
 * screen — one computation, so the two sides cannot tell different stories.
 */
export async function getMyReliability(req: Request, res: Response): Promise<void> {
  ok(res, await buildReliability(currentUser(req)._id));
}

export async function getNotificationPrefs(req: Request, res: Response): Promise<void> {
  ok(res, currentUser(req).notificationPrefs);
}

/** Whole replace — all five booleans are required by the schema. */
export async function putNotificationPrefs(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  user.notificationPrefs = req.body as NotificationPrefs;
  await user.save();
  ok(res, user.notificationPrefs);
}

/**
 * The bell's whole payload: the list and the badge in one round trip.
 *
 * Polled every time the home screen gains focus, so it stays two indexed
 * queries and nothing more.
 */
export async function getMyNotifications(req: Request, res: Response): Promise<void> {
  ok(res, await buildFeed(currentUser(req)._id));
}

/** Opening the inbox is the read receipt. Idempotent — re-reading is a no-op. */
export async function postNotificationsRead(req: Request, res: Response): Promise<void> {
  ok(res, await markAllRead(currentUser(req)._id));
}

/** Called on every launch, so it has to be idempotent. */
export async function putPushToken(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  user.pushToken = (req.body as { token: string }).token;
  await user.save();
  okNull(res);
}
