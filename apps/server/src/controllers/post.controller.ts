import type { Request, Response } from 'express';
import type { CreatePostInput, UpdatePostInput } from '@m-ensemble/shared';
import { PostModel, type PostDocument } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { currentUser } from '../middleware/requireAuth.js';
import { assertAdmin } from '../services/access.service.js';
import { likePost, unlikePost } from '../services/like.service.js';
import { checkInSignup, claimSlot, withdrawSlot } from '../services/signup.service.js';
import { fanOutNewPost } from '../services/push.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { ok, okNull } from '../utils/respond.js';

/** `requireAdmin(fromPost)` already loaded and stashed it — don't refetch. */
function loadedPost(req: Request): PostDocument {
  if (!req.post) throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');
  return req.post;
}

async function findPostOr404(id: string): Promise<PostDocument> {
  const post = await PostModel.findById(id);
  if (!post) throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');
  return post;
}

/**
 * Any signed-in user, any post — including posts at mosques they don't follow.
 * "My Stuff" hydrates saved posts through here. Cancelled posts are returned;
 * the detail screen renders them with a "Cancelled" banner.
 */
export async function getPost(req: Request, res: Response): Promise<void> {
  const post = await findPostOr404(String(req.params.id));
  ok(res, post.toJSON());
}

export async function createPost(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const input = req.body as CreatePostInput;

  const post = await PostModel.create({
    ...input,
    _id: newId(),
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    slotsFilled: 0,
    createdBy: user._id,
    createdAt: new Date(),
  });

  ok(res, post.toJSON(), 201);

  // After the response, never blocking it. A slow Expo call must not make the
  // coordinator's "Post" button feel broken.
  void fanOutNewPost(post).catch((err) => console.error('[push] fan-out failed', err));
}

export async function updatePost(req: Request, res: Response): Promise<void> {
  const post = loadedPost(req);
  const patch = req.body as UpdatePostInput;

  // The schema checks the pair when both arrive; a patch that moves only one
  // end is checked against what is stored.
  const nextStart = patch.startAt ? new Date(patch.startAt) : post.startAt;
  const nextEnd = patch.endAt ? new Date(patch.endAt) : post.endAt;
  if (nextEnd.getTime() <= nextStart.getTime()) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'endAt must be after startAt');
  }

  Object.assign(post, patch);
  post.startAt = nextStart;
  post.endAt = nextEnd;

  // `imageUrl: null` means the admin removed the poster. Assigning null would
  // store a null and serialise it into a field the contract types as an
  // optional string; `undefined` is what Mongoose reads as "unset this".
  if (patch.imageUrl === null) post.set('imageUrl', undefined);

  await post.save();
  ok(res, post.toJSON());
}

/** Idempotent — cancelling twice keeps the first timestamp. */
export async function cancelPost(req: Request, res: Response): Promise<void> {
  const post = loadedPost(req);
  if (!post.cancelledAt) {
    post.cancelledAt = new Date();
    await post.save();
  }
  ok(res, post.toJSON());
}

export async function signUpForPost(req: Request, res: Response): Promise<void> {
  const signup = await claimSlot(String(req.params.id), currentUser(req)._id);
  ok(res, signup.toJSON(), 201);
}

/**
 * Returns what the withdrawal actually did rather than `null`, so the screen
 * can tell the volunteer whether it went on their record. The server decides
 * that — the client's warning is a courtesy, not the rule.
 */
export async function withdrawFromPost(req: Request, res: Response): Promise<void> {
  ok(res, await withdrawSlot(String(req.params.id), currentUser(req)._id));
}

/** **All statuses** — the app filters `confirmed` itself. */
export async function getPostSignups(req: Request, res: Response): Promise<void> {
  const postId = String(req.params.id);
  await findPostOr404(postId);

  const signups = await SignupModel.find({ postId });
  ok(
    res,
    signups.map((s) => s.toJSON()),
  );
}

/**
 * Dual permission: you may check *yourself* in — that is the QR flow, and the
 * member scanning the code is not an admin — but checking anyone else in needs
 * the coordinator role at that post's mosque.
 */
/**
 * Like / unlike. No admin check and no follow check on purpose — anyone who
 * can read a post can heart it, and the count is the only thing anybody sees.
 * Both are safe to repeat; the service, not the route, is what makes them so.
 */
export async function postLike(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  ok(res, await likePost(String(req.params.id), user._id));
}

export async function deleteLike(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  ok(res, await unlikePost(String(req.params.id), user._id));
}

export async function checkIn(req: Request, res: Response): Promise<void> {
  const actor = currentUser(req);
  const postId = String(req.params.id);
  const { userId } = req.body as { userId: string };

  const post = await findPostOr404(postId);
  if (actor._id !== userId) {
    await assertAdmin(actor._id, post.mosqueId);
  }

  await checkInSignup(postId, userId);
  okNull(res);
}
