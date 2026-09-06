import type { Request } from 'express';
import { UserModel, type UserDocument } from '../models/User.js';
import { bearerFrom, userIdFromToken } from '../services/auth.service.js';
import { HttpError } from './errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Verifies the bearer token and loads the user onto `req.user`.
 *
 * Every failure is **401**, including a well-formed token whose user has since
 * been deleted. The app's cold-start check is `err.status === 401` and nothing
 * else — a 403 here would strand the session on a dead token instead of
 * signing it out.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = bearerFrom(req.headers.authorization);
  const userId = token ? userIdFromToken(token) : null;

  if (!userId) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Sign in to continue.');
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Sign in to continue.');
  }

  req.user = user;
  next();
});

/**
 * `req.user` after `requireAuth`. The augmentation is optional because the
 * middleware may not have run; every route below it has, so this narrows once
 * instead of at forty call sites.
 */
export function currentUser(req: Request): UserDocument {
  if (!req.user) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Sign in to continue.');
  }
  return req.user;
}
