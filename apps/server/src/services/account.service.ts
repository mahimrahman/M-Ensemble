import { createHash, randomBytes } from 'node:crypto';
import type { AccountExport } from '@m-ensemble/shared';
import { env } from '../config/env.js';
import { DonationModel } from '../models/Donation.js';
import { EmailTokenModel, type EmailTokenDocument, type EmailTokenKind } from '../models/EmailToken.js';
import { FollowModel } from '../models/Follow.js';
import { LikeModel } from '../models/Like.js';
import { MembershipModel } from '../models/Membership.js';
import { NotificationModel } from '../models/Notification.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { UserModel, type UserDocument } from '../models/User.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { logger } from '../utils/logger.js';
import { apiUrl, renderEmail, sendEmail, webUrl } from './email.service.js';
import { hashPassword, verifyPassword } from './auth.service.js';

/**
 * The account lifecycle past sign-up: resets, verification, deletion, export.
 *
 * Everything that mails a secret goes through `issueToken`/`consumeToken`, so
 * there is exactly one place that decides how long a link lives and one place
 * that decides whether it is still good.
 */

const RESET_TTL_MS = 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Mints a fresh token and retires any unused one of the same kind for the
 * user — two reset emails in a row should leave exactly one working link.
 * Returns the raw token; only its hash is stored.
 */
async function issueToken(userId: string, kind: EmailTokenKind, ttlMs: number): Promise<string> {
  await EmailTokenModel.deleteMany({ userId, kind, usedAt: { $exists: false } });
  const token = randomBytes(32).toString('base64url');
  await EmailTokenModel.create({
    _id: newId(),
    userId,
    kind,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/**
 * Spends a token. The expiry is checked here as well as by the TTL index —
 * Mongo's sweeper runs once a minute, so a row can outlive its `expiresAt`.
 */
async function consumeToken(token: string, kind: EmailTokenKind): Promise<EmailTokenDocument> {
  const row = await EmailTokenModel.findOneAndUpdate(
    { tokenHash: sha256(token), kind, usedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  );
  if (!row) {
    throw new HttpError(
      400,
      ERROR.INVALID_TOKEN,
      'That link has expired or was already used. Request a new one.',
    );
  }
  return row;
}

/** An account that can still be acted on: not anonymised. */
function liveUser(user: UserDocument | null): UserDocument | null {
  return user && !user.deletedAt ? user : null;
}

// ─── Password reset ─────────────────────────────────────────────────────────

/**
 * Always resolves, and takes about the same time either way: the response
 * must not say whether the address has an account. A suspended account still
 * gets the email — the reset itself works, and sign-in is where suspension is
 * enforced.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = liveUser(await UserModel.findOne({ email: email.trim().toLowerCase() }));
  if (!user) {
    logger.info({ email }, '[account] reset requested for unknown address');
    return;
  }

  const token = await issueToken(user._id, 'reset', RESET_TTL_MS);
  const link = `${webUrl('/reset-password')}?token=${token}`;
  const deepLink = `${env.APP_SCHEME}://reset-password?token=${token}`;

  const { text, html } = renderEmail(`Reset your password / Réinitialiser votre mot de passe`, [
    `Hi ${user.name}, someone asked to reset the password for this M’Ensemble account. The link below works for one hour. If that wasn’t you, ignore this email — your password has not changed.`,
    { button: 'Reset password', url: link },
    `Bonjour ${user.name}, une demande de réinitialisation du mot de passe de ce compte M’Ensemble a été reçue. Le lien ci-dessus est valide pendant une heure. Si ce n’était pas vous, ignorez ce courriel — votre mot de passe n’a pas changé.`,
    `On your phone with the app installed, this link opens it directly / Sur votre téléphone, ce lien ouvre directement l’application : ${deepLink}`,
  ]);

  await sendEmail({ to: user.email, subject: 'Reset your M’Ensemble password', text, html });
}

/**
 * Sets the new password and signs out every device. Opening the link also
 * proves control of the mailbox, so the address is marked verified in passing.
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const row = await consumeToken(token, 'reset');
  const user = liveUser(await UserModel.findById(row.userId));
  if (!user) {
    throw new HttpError(400, ERROR.INVALID_TOKEN, 'That account no longer exists.');
  }

  user.passwordHash = await hashPassword(password);
  user.tokenVersion += 1;
  user.mustChangePassword = undefined;
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  await user.save();
}

/**
 * Signed-in password change. Bumps the version, which kills the caller's own
 * token too — the controller hands back a fresh one so the current device
 * stays signed in while every other one is dropped.
 *
 * A wrong current password is a 400, not a 401: the app treats 401 as "signed
 * out", and a typo in a settings form must not do that.
 */
export async function changePassword(
  user: UserDocument,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, ERROR.BAD_CREDENTIALS, 'Your current password is incorrect.');
  }
  user.passwordHash = await hashPassword(nextPassword);
  user.tokenVersion += 1;
  user.mustChangePassword = undefined;
  await user.save();
}

// ─── Email verification ─────────────────────────────────────────────────────

/** No-op once the address is confirmed. */
export async function sendVerificationEmail(user: UserDocument): Promise<void> {
  if (user.emailVerifiedAt || user.deletedAt) return;

  const token = await issueToken(user._id, 'verify', VERIFY_TTL_MS);
  const link = `${apiUrl('/api/verify-email')}?token=${token}`;

  const { text, html } = renderEmail('Confirm your email / Confirmez votre courriel', [
    `Welcome to M’Ensemble, ${user.name}. Tap the button to confirm this address. The link works for 24 hours.`,
    { button: 'Confirm email', url: link },
    `Bienvenue sur M’Ensemble, ${user.name}. Appuyez sur le bouton pour confirmer cette adresse. Le lien est valide pendant 24 heures.`,
    `If you didn’t create an account, you can ignore this email. / Si vous n’avez pas créé de compte, ignorez simplement ce courriel.`,
  ]);

  await sendEmail({ to: user.email, subject: 'Confirm your M’Ensemble email', text, html });
}

export async function verifyEmail(token: string): Promise<UserDocument> {
  const row = await consumeToken(token, 'verify');
  const user = liveUser(await UserModel.findById(row.userId));
  if (!user) {
    throw new HttpError(400, ERROR.INVALID_TOKEN, 'That account no longer exists.');
  }
  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    await user.save();
  }
  return user;
}

// ─── Deletion ───────────────────────────────────────────────────────────────

/**
 * Deletes an account — by anonymising it.
 *
 * The row stays, scrubbed, because other rows point at it: attendance on past
 * shifts, the audit log, donation records a mosque needs for its books. What
 * identifies the person — name, email, password, interests, push token — goes,
 * along with everything that only existed for them (follows, likes, inbox).
 * Future commitments are withdrawn so the slots open up again. Past signups
 * stay, pointing at "Deleted user".
 *
 * Refused when the person is the last coordinator anywhere: a mosque with no
 * admin cannot be run from the app, and only a human can decide who takes over.
 */
export async function deleteAccount(user: UserDocument, password: string): Promise<void> {
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(400, ERROR.BAD_CREDENTIALS, 'Your password is incorrect.');
  }

  const adminAt = await MembershipModel.find({ userId: user._id, role: 'admin' });
  for (const membership of adminAt) {
    const others = await MembershipModel.countDocuments({
      mosqueId: membership.mosqueId,
      role: 'admin',
      userId: { $ne: user._id },
    });
    if (others === 0) {
      throw new HttpError(
        409,
        ERROR.LAST_COORDINATOR,
        'You are the only coordinator of a mosque. Make someone else a coordinator first, then delete your account.',
      );
    }
  }

  // Upcoming commitments: give the slots back. Not `withdrawSlot` — that stamps
  // a late cancellation inside 24h, and a reliability mark on an account that
  // is ceasing to exist tells nobody anything.
  const now = new Date();
  const confirmed = await SignupModel.find({ userId: user._id, status: 'confirmed' });
  const upcoming = await PostModel.find({
    _id: { $in: confirmed.map((s) => s.postId) },
    endAt: { $gte: now },
  }).select({ _id: 1 });
  for (const post of upcoming) {
    const withdrawn = await SignupModel.updateOne(
      { postId: post._id, userId: user._id, status: 'confirmed' },
      { $set: { status: 'withdrawn' }, $unset: { checkedInAt: '' } },
    );
    if (withdrawn.modifiedCount > 0) {
      await PostModel.updateOne({ _id: post._id, slotsFilled: { $gt: 0 } }, { $inc: { slotsFilled: -1 } });
    }
  }

  // Likes come off the posts' cached counts the same way `unlikePost` does:
  // recount, never decrement.
  const likes = await LikeModel.find({ userId: user._id }).select({ postId: 1 });
  await LikeModel.deleteMany({ userId: user._id });
  for (const postId of new Set(likes.map((l) => l.postId))) {
    const likeCount = await LikeModel.countDocuments({ postId });
    await PostModel.updateOne({ _id: postId }, { $set: { likeCount } });
  }

  await Promise.all([
    FollowModel.deleteMany({ userId: user._id }),
    NotificationModel.deleteMany({ userId: user._id }),
    EmailTokenModel.deleteMany({ userId: user._id }),
    // Every role goes, admin ones included — the last-coordinator check above
    // already guaranteed each mosque keeps someone. A "Deleted user" must not
    // appear in a coordinator list.
    MembershipModel.deleteMany({ userId: user._id }),
  ]);

  user.name = 'Deleted user';
  user.email = `deleted+${user._id}@deleted.invalid`;
  // A hash of random bytes nobody holds: the row has a password nobody knows.
  user.passwordHash = await hashPassword(randomBytes(32).toString('base64url'));
  user.interests = [];
  user.pushToken = undefined;
  user.status = 'suspended';
  user.deletedAt = now;
  user.tokenVersion += 1;
  await user.save();

  logger.info({ userId: user._id }, '[account] deleted');
}

// ─── Export ─────────────────────────────────────────────────────────────────

const iso = (d: Date | undefined): string | undefined => d?.toISOString();

/** Everything held about one person, in the shape the contract promises. */
export async function exportAccount(user: UserDocument): Promise<AccountExport> {
  const [memberships, follows, signups, likes, notifications, donations] = await Promise.all([
    MembershipModel.find({ userId: user._id }),
    FollowModel.find({ userId: user._id }),
    SignupModel.find({ userId: user._id }),
    LikeModel.find({ userId: user._id }),
    NotificationModel.find({ userId: user._id }).sort({ createdAt: -1 }),
    DonationModel.find({ userId: user._id }).sort({ createdAt: -1 }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      interests: user.interests,
      emailVerified: Boolean(user.emailVerifiedAt),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: iso(user.lastLoginAt),
    },
    notificationPrefs: { ...user.notificationPrefs },
    memberships: memberships.map((m) => ({
      mosqueId: m.mosqueId,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    })),
    follows: follows.map((f) => ({ mosqueId: f.mosqueId, createdAt: f.createdAt.toISOString() })),
    signups: signups.map((s) => ({
      postId: s.postId,
      status: s.status,
      createdAt: iso(s.createdAt),
      checkedInAt: iso(s.checkedInAt),
      lateCancelledAt: iso(s.lateCancelledAt),
      noShowAt: iso(s.noShowAt),
    })),
    likes: likes.map((l) => ({ postId: l.postId, createdAt: l.createdAt.toISOString() })),
    notifications: notifications.map((n) => ({
      title: n.title,
      body: n.body,
      createdAt: n.createdAt.toISOString(),
      readAt: iso(n.readAt),
    })),
    donations: donations.map((d) => ({
      mosqueId: d.mosqueId,
      amountCents: d.amountCents,
      currency: d.currency,
      createdAt: d.createdAt.toISOString(),
    })),
  };
}
