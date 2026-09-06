import type { Request, Response } from 'express';
import type { AuthResult } from '@m-ensemble/shared';
import { UserModel } from '../models/User.js';
import { defaultNotificationPrefs } from '../shared.js';
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

  const result: AuthResult = { token: signToken(user._id), user: user.toJSON() };
  ok(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const user = await UserModel.findOne({ email: email.trim().toLowerCase() });

  // One message for both halves — never confirm that an email exists.
  const bad = () =>
    new HttpError(401, ERROR.BAD_CREDENTIALS, 'Email or password is incorrect.');

  if (!user) throw bad();
  if (!(await verifyPassword(password, user.passwordHash))) throw bad();

  const result: AuthResult = { token: signToken(user._id), user: user.toJSON() };
  ok(res, result);
}
