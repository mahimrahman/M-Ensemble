import type { Request, Response } from 'express';
import type { AuthResult } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MembershipModel } from '../models/Membership.js';
import { RevokedTokenModel } from '../models/RevokedToken.js';
import { UserModel } from '../models/User.js';
import { coordinatorMosqueFor, defaultNotificationPrefs } from '../shared.js';
import {
  bearerFrom,
  claimsFromToken,
  hashPassword,
  signToken,
  verifyPassword,
} from '../services/auth.service.js';
import * as account from '../services/account.service.js';
import { currentUser } from '../middleware/requireAuth.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { logger } from '../utils/logger.js';
import { ok, okNull } from '../utils/respond.js';

export async function signup(req: Request, res: Response): Promise<void> {
  const { email, password, name } = req.body as { email: string; password: string; name: string };
  const normalised = email.trim().toLowerCase();

  if (await UserModel.exists({ email: normalised })) {
    throw new HttpError(409, ERROR.EMAIL_TAKEN, 'That email already has an account.');
  }

  const user = await UserModel.create({
    _id: newId(),
    name: name.trim(),
    email: normalised,
    passwordHash: await hashPassword(password),
    // Onboarding fills these in; the app sends them through PATCH /me.
    interests: [],
    notificationPrefs: { ...defaultNotificationPrefs },
  });

  // Coordinator access is granted, never requested. An email the mosque gave
  // us is on the allowlist and holds the admin role from its first session;
  // anything else is an ordinary member, and no request body can change that —
  // the role is derived from the email, never read off the input.
  const mosqueId = coordinatorMosqueFor(normalised);
  if (mosqueId) {
    const createdAt = new Date();
    await MembershipModel.create({
      _id: newId(),
      userId: user._id,
      mosqueId,
      role: 'admin',
      createdAt,
    });
    // A coordinator follows the mosque they run, so its feed is theirs too.
    // Separate from the membership on purpose: they can unfollow and keep the
    // role, which is why `Follow` and `Membership` are different collections.
    await FollowModel.create({ _id: newId(), userId: user._id, mosqueId, createdAt });
  }

  const result: AuthResult = { token: signToken(user), user: user.toJSON() };
  ok(res, result, 201);

  // After the response. A slow mail provider must not make sign-up feel broken,
  // and a failed send is a nag in the app, not a failed account.
  void account
    .sendVerificationEmail(user)
    .catch((err) => logger.error({ err, userId: user._id }, '[account] verification email failed'));
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() });

  // One message for both halves — never confirm that an email exists.
  const bad = () => new HttpError(401, ERROR.BAD_CREDENTIALS, 'Email or password is incorrect.');

  if (!user) throw bad();
  if (!(await verifyPassword(password, user.passwordHash))) throw bad();

  // Checked *after* the password, not before. Answering "suspended" to a wrong
  // password would confirm the email exists, which is the one thing the shared
  // `bad()` message above exists to avoid.
  if (user.status === 'suspended') {
    throw new HttpError(
      403,
      ERROR.ACCOUNT_SUSPENDED,
      'This account has been suspended. Contact support if you think that is a mistake.',
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const result: AuthResult = { token: signToken(user), user: user.toJSON() };
  ok(res, result);
}

// ─── Password reset ─────────────────────────────────────────────────────────

/** 200 whatever happens — see `requestPasswordReset`. */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await account.requestPasswordReset((req.body as { email: string }).email);
  okNull(res);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };
  await account.resetPassword(token, password);
  okNull(res);
}

/**
 * Changing the password bumps `tokenVersion`, which would sign this device out
 * too. The reply carries a fresh token so the app can swap it in and stay
 * signed in; the contract types the call as `void`, so a client that ignores
 * the body simply gets a 401 next and re-authenticates.
 */
export async function changePassword(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  await account.changePassword(user, currentPassword, newPassword);
  ok(res, { token: signToken(user) });
}

// ─── Email verification ─────────────────────────────────────────────────────

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const user = await account.verifyEmail((req.body as { token: string }).token);
  ok(res, user.toJSON());
}

export async function resendVerification(req: Request, res: Response): Promise<void> {
  await account.sendVerificationEmail(currentUser(req));
  okNull(res);
}

// ─── Sign-out ───────────────────────────────────────────────────────────────

/**
 * Revokes the token that made this request. Idempotent: `requireAuth` already
 * proved the token valid, so the row either inserts or already exists.
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const claims = claimsFromToken(bearerFrom(req.headers.authorization) ?? '');

  // A legacy token has no jti to denylist. The only lever left is the version
  // bump, which signs out every device — acceptable for a token that predates
  // revocation, since it also retires the rest of that generation.
  if (!claims?.jti) {
    user.tokenVersion += 1;
    await user.save();
  } else {
    await RevokedTokenModel.updateOne(
      { _id: claims.jti },
      { $setOnInsert: { userId: user._id, expiresAt: new Date(claims.exp * 1000) } },
      { upsert: true },
    );
  }
  okNull(res);
}
