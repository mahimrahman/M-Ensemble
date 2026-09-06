import type { Request, Response } from 'express';
import type { AuthResult } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MembershipModel } from '../models/Membership.js';
import { UserModel } from '../models/User.js';
import { coordinatorMosqueFor, defaultNotificationPrefs } from '../shared.js';
import { hashPassword, signToken, verifyPassword } from '../services/auth.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { ok } from '../utils/respond.js';

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

  const result: AuthResult = { token: signToken(user._id), user: user.toJSON() };
  ok(res, result, 201);
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

  const result: AuthResult = { token: signToken(user._id), user: user.toJSON() };
  ok(res, result);
}
