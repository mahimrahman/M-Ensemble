import type { Request, RequestHandler } from 'express';
import { PostModel } from '../models/Post.js';
import { assertAdmin } from '../services/access.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { currentUser } from './requireAuth.js';
import { HttpError } from './errorHandler.js';
import { ERROR } from '../utils/errors.js';

/** Where the mosque id comes from. Three routes shapes, three sources. */
export type MosqueIdSource = (req: Request) => string | Promise<string>;

/** `/mosques/:id/*` — straight off the route. */
export const fromParam =
  (name = 'id'): MosqueIdSource =>
  (req) =>
    String(req.params[name]);

/**
 * `POST /posts` — off the body. Mount **after** `validate(createPostSchema)`
 * so `mosqueId` is guaranteed present and a string.
 */
export const fromBody =
  (field = 'mosqueId'): MosqueIdSource =>
  (req) =>
    String((req.body as Record<string, unknown>)[field]);

/**
 * `/posts/:id/*` — off the post, which is loaded here and stashed on the
 * request so the controller behind it doesn't fetch the same row again.
 *
 * A missing post is **404 before 403**: the mock checks `requirePost` first,
 * and leaking "this id exists but isn't yours" would be the only way to tell
 * the two apart.
 */
export const fromPost: MosqueIdSource = async (req) => {
  const post = await PostModel.findById(String(req.params.id));
  if (!post) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');
  }
  req.post = post;
  return post.mosqueId;
};

/** Requires an admin `Membership` for the mosque the source resolves to. */
export function requireAdmin(getMosqueId: MosqueIdSource): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const user = currentUser(req);
    const mosqueId = await getMosqueId(req);
    await assertAdmin(user._id, mosqueId);
    req.mosqueId = mosqueId;
    next();
  });
}

/**
 * Admin only when `when` says so. Express cannot route on a query string, and
 * `GET /mosques/:id/posts?all=true` is the admin view of the same path that
 * serves every signed-in member without the flag.
 */
export function requireAdminIf(
  when: (req: Request) => boolean,
  getMosqueId: MosqueIdSource,
): RequestHandler {
  const guard = requireAdmin(getMosqueId);
  return (req, res, next) => {
    if (when(req)) {
      guard(req, res, next);
      return;
    }
    next();
  };
}
