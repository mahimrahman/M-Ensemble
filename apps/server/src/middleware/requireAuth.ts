import type { Request } from 'express';
import { UserModel, type UserDocument } from '../models/User.js';
import { RevokedTokenModel } from '../models/RevokedToken.js';
import { bearerFrom, claimsFromToken } from '../services/auth.service.js';
import { HttpError } from './errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Verifies the bearer token and loads the user onto `req.user`.
 *
 * Every failure is **401**, including a well-formed token whose user has since
 * been deleted or signed out. The app's cold-start check is `err.status === 401`
 * and nothing else — a 403 here would strand the session on a dead token
 * instead of signing it out.
 */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = bearerFrom(req.headers.authorization);
  const claims = token ? claimsFromToken(token) : null;

  if (!claims) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Sign in to continue.');
  }

  const user = await UserModel.findById(claims.sub);
  if (!user) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Sign in to continue.');
  }

  // Two revocation checks. The version compare is free and catches "sign out
  // everywhere" (password change, deletion); the denylist lookup is one indexed
  // read on a collection the TTL monitor keeps tiny, and catches a single
  // explicit sign-out. Legacy tokens have no jti and skip the second.
  if (claims.tv !== user.tokenVersion) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Your session has ended. Sign in again.');
  }
  if (claims.jti && (await RevokedTokenModel.exists({ _id: claims.jti }))) {
    throw new HttpError(401, ERROR.UNAUTHORIZED, 'Your session has ended. Sign in again.');
  }

  // A suspended account is signed out on its very next request, not just
  // blocked at the login screen — otherwise someone already holding a valid
  // token keeps full access until it expires, which makes suspension useless
  // for the case it exists for. 401 rather than 403 on purpose: the app's
  // cold-start check signs out on 401 and nothing else.
  if (user.status === 'suspended') {
    throw new HttpError(401, ERROR.ACCOUNT_SUSPENDED, 'This account has been suspended.');
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
