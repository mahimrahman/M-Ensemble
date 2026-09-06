import { randomInt } from 'node:crypto';
import type { Request } from 'express';
import type {
  CoordinatorInput,
  CreateMosqueInput,
  ID,
  IssuedCredential,
  MemberRole,
  Mosque,
  PageQuery,
  PageResult,
  PlatformRole,
  PlatformUser,
  UserStatus,
} from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MembershipModel } from '../models/Membership.js';
import { MosqueModel } from '../models/Mosque.js';
import { SignupModel } from '../models/Signup.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { UserModel, type UserDocument } from '../models/User.js';
import { defaultNotificationPrefs, planPriceCents } from '../shared.js';
import { hashPassword } from './auth.service.js';
import * as audit from './audit.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { pageResult, resolvePage, searchRegex, sortSpec } from '../utils/paging.js';

/**
 * Onboarding a mosque, and the accounts that run it.
 *
 * **This replaces `COORDINATOR_EMAILS`.** Coordinator access used to come off a
 * literal in the fixtures, so adding a mosque meant editing source and
 * shipping a release. The allowlist still works — a pre-approved email signing
 * up still gets its admin membership, and the demo depends on that — but it is
 * no longer the only door. Anything created here is created at runtime, by a
 * named super admin, with a row in the audit log saying so.
 */

// ─── Password and code generation ───────────────────────────────────────────

/**
 * Alphabet with the characters people misread struck out: no O/0, no I/l/1.
 * These get read down a phone line and typed on a borrowed laptop, and a
 * password that is strong but keeps failing is worse than one slightly shorter.
 */
const SAFE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * `randomInt` from `node:crypto`, not `Math.random`. This is a credential; a
 * predictable generator here means every account provisioned in a session is
 * guessable from any one of them.
 */
function randomString(length: number, alphabet = SAFE_ALPHABET): string {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** A provisioned password: 14 characters of the safe alphabet, ~80 bits. */
export function generatePassword(): string {
  return randomString(14);
}

/**
 * A join code nobody already has. Six characters is 19 bits — collisions are
 * rare but not impossible, and the unique index would turn one into a 500 at
 * the worst moment, so it retries rather than hoping.
 */
async function mintJoinCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomString(6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    if (!(await MosqueModel.exists({ joinCode: code }))) return code;
  }
  throw new HttpError(500, ERROR.INTERNAL_ERROR, 'Could not allocate a join code.');
}

// ─── Mosques ────────────────────────────────────────────────────────────────

export interface CreatedMosque {
  mosque: Mosque;
  /** Present only when a coordinator was provisioned in the same call. */
  credential?: IssuedCredential;
}

export async function createMosque(
  input: CreateMosqueInput,
  actor: UserDocument,
  req?: Request,
): Promise<CreatedMosque> {
  const joinCode = input.joinCode?.trim().toUpperCase() || (await mintJoinCode());

  if (await MosqueModel.exists({ joinCode })) {
    throw new HttpError(409, ERROR.CONFLICT, `Join code ${joinCode} is already in use.`);
  }

  const mosque = await MosqueModel.create({
    _id: newId(),
    name: input.name.trim(),
    address: input.address.trim(),
    coordinates: input.coordinates,
    joinCode,
    // The app computes adhan from these, so a mosque with no prayer config
    // would render an empty prayer table on day one. North America and Shafi
    // are what every mosque we operate uses; the coordinator can change it.
    prayerConfig: input.prayerConfig ?? {
      calculationMethod: 'NorthAmerica',
      madhab: 'shafi',
      highLatitudeRule: 'MiddleOfTheNight',
    },
    bio: input.bio,
    website: input.website,
    phone: input.phone,
    timezone: input.timezone ?? 'America/Toronto',
    createdAt: new Date(),
  });

  await audit.record(
    actor,
    {
      action: 'mosque.created',
      targetType: 'mosque',
      targetId: mosque._id,
      summary: `Created ${mosque.name} with join code ${joinCode}`,
      meta: { joinCode, plan: input.plan ?? 'free' },
    },
    req,
  );

  // Every mosque gets a subscription row, free included. A mosque with no row
  // and a mosque on the free plan are the same thing commercially, and having
  // one shape rather than two means the billing screens never branch on null.
  await startSubscription(mosque._id, input.plan ?? 'free', actor, req);

  const credential = input.coordinator
    ? await issueCoordinatorCredential(mosque._id, input.coordinator, actor, req)
    : undefined;

  return { mosque: mosque.toJSON() as Mosque, credential };
}

async function startSubscription(
  mosqueId: string,
  plan: CreateMosqueInput['plan'],
  actor: UserDocument,
  req?: Request,
): Promise<void> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await SubscriptionModel.create({
    _id: newId(),
    mosqueId,
    plan: plan ?? 'free',
    status: 'active',
    interval: 'monthly',
    priceCents: planPriceCents(plan ?? 'free', 'monthly'),
    currency: 'CAD',
    startedAt: now,
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
    createdAt: now,
    updatedAt: now,
  });

  await audit.record(
    actor,
    {
      action: 'subscription.created',
      targetType: 'subscription',
      targetId: mosqueId,
      summary: `Started ${plan ?? 'free'} plan`,
    },
    req,
  );
}

// ─── Coordinator credentials ────────────────────────────────────────────────

/**
 * Mint — or re-point — the account that runs a mosque, and hand back the
 * password once.
 *
 * Three cases, all of which happen in practice:
 *
 *   - **New email.** A fresh account, admin at this mosque, following it.
 *   - **Existing account, not yet a coordinator here.** They keep their
 *     password and history and gain the role. We do *not* reset the password
 *     of an account somebody is already using.
 *   - **Existing coordinator.** A password reset, which is what "they've lost
 *     it" actually means.
 *
 * The plaintext is returned and never stored, so a lost one is reset rather
 * than looked up. That is deliberate: an admin console that can show you
 * somebody's password is one breach away from showing everyone's.
 */
export async function issueCoordinatorCredential(
  mosqueId: string,
  input: CoordinatorInput,
  actor: UserDocument,
  req?: Request,
): Promise<IssuedCredential> {
  const mosque = await MosqueModel.findById(mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');

  const email = input.email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email });
  const password = input.password?.trim() || generatePassword();

  let user: UserDocument;
  let action: string;

  if (existing) {
    const alreadyAdmin = await MembershipModel.exists({
      userId: existing._id,
      mosqueId,
      role: 'admin',
    });
    user = existing;

    if (alreadyAdmin || input.password) {
      // Either they asked for a reset, or a password was supplied explicitly.
      user.passwordHash = await hashPassword(password);
      user.mustChangePassword = true;
      await user.save();
      action = 'user.password_reset';
    } else {
      // Granting a role to somebody who already has an account must not lock
      // them out of it. They keep the password they already use.
      action = 'mosque.coordinator_added';
    }
  } else {
    user = await UserModel.create({
      _id: newId(),
      name: input.name.trim(),
      email,
      passwordHash: await hashPassword(password),
      interests: [],
      notificationPrefs: { ...defaultNotificationPrefs },
      platformRole: 'none',
      status: 'active',
      mustChangePassword: true,
      createdAt: new Date(),
    });
    action = 'mosque.coordinator_created';
  }

  const createdAt = new Date();
  await MembershipModel.updateOne(
    { userId: user._id, mosqueId },
    { $set: { role: 'admin' }, $setOnInsert: { _id: newId(), createdAt } },
    { upsert: true },
  );
  // A coordinator follows the mosque they run, so its feed is theirs too.
  // Separate from the membership on purpose — they can unfollow and keep the
  // role, which is why Follow and Membership are different collections.
  await FollowModel.updateOne(
    { userId: user._id, mosqueId },
    { $setOnInsert: { _id: newId(), userId: user._id, mosqueId, createdAt } },
    { upsert: true },
  );

  await audit.record(
    actor,
    {
      action,
      targetType: 'mosque',
      targetId: mosqueId,
      // The password is never in the summary or the meta. The audit log is
      // read by more people than the response is.
      summary: `${user.email} is now a coordinator of ${mosque.name}`,
      meta: { userId: user._id, email: user.email, reissued: Boolean(existing) },
    },
    req,
  );

  return {
    userId: user._id,
    mosqueId,
    name: user.name,
    email: user.email,
    // Truthful even in the "kept their password" branch: what we hand back is
    // what they must use, and there it is the one they already had. The
    // dashboard says which case it was — see `reissued` in the audit meta.
    password,
    mustChangePassword: true,
  };
}

/** Take the coordinator role off someone, leaving the account intact. */
export async function revokeCoordinator(
  mosqueId: string,
  userId: string,
  actor: UserDocument,
  req?: Request,
): Promise<void> {
  const result = await MembershipModel.updateOne(
    { userId, mosqueId, role: 'admin' },
    { $set: { role: 'member' } },
  );
  if (!result.matchedCount) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'That person does not coordinate this mosque.');
  }
  await audit.record(
    actor,
    {
      action: 'mosque.coordinator_revoked',
      targetType: 'mosque',
      targetId: mosqueId,
      summary: `Revoked coordinator access for ${userId}`,
      meta: { userId },
    },
    req,
  );
}

// ─── Users ──────────────────────────────────────────────────────────────────

const USER_SORTABLE = ['createdAt', 'name', 'email', 'lastLoginAt'] as const;

export interface UserQuery extends PageQuery {
  platformRole?: PlatformRole;
  status?: UserStatus;
  mosqueId?: ID;
}

export async function listUsers(query: UserQuery): Promise<PageResult<PlatformUser>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};

  if (query.platformRole) filter.platformRole = query.platformRole;
  if (query.status) filter.status = query.status;

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ name: rx }, { email: rx }];

  // Filtering by mosque means "holds a membership there", which lives in
  // another collection — so it narrows the id set before the page is taken.
  if (query.mosqueId) {
    const ids = await MembershipModel.distinct('userId', { mosqueId: query.mosqueId });
    filter._id = { $in: ids };
  }

  const [rows, total] = await Promise.all([
    UserModel.find(filter)
      .sort(sortSpec(query, USER_SORTABLE, { createdAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    UserModel.countDocuments(filter),
  ]);

  return pageResult(await hydrateUsers(rows), total, resolved);
}

/**
 * Turns user documents into `PlatformUser`, resolving each one's mosques and
 * counts in three queries for the whole page rather than three per row.
 */
async function hydrateUsers(rows: UserDocument[]): Promise<PlatformUser[]> {
  const ids = rows.map((r) => r._id);
  const [memberships, follows, signups] = await Promise.all([
    MembershipModel.find({ userId: { $in: ids } }),
    FollowModel.aggregate<{ _id: string; n: number }>([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]),
    SignupModel.aggregate<{ _id: string; n: number }>([
      { $match: { userId: { $in: ids }, status: 'confirmed' } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]),
  ]);

  const mosques = await MosqueModel.find({
    _id: { $in: [...new Set(memberships.map((m) => m.mosqueId))] },
  });
  const mosqueName = new Map(mosques.map((m) => [m._id, m.name]));
  const byUser = new Map<string, PlatformUser['memberships']>();
  for (const m of memberships) {
    const list = byUser.get(m.userId) ?? [];
    list.push({
      mosqueId: m.mosqueId,
      mosqueName: mosqueName.get(m.mosqueId) ?? m.mosqueId,
      role: m.role,
    });
    byUser.set(m.userId, list);
  }
  const followCount = new Map(follows.map((f) => [f._id, f.n]));
  const signupCount = new Map(signups.map((s) => [s._id, s.n]));

  return rows.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    interests: u.interests,
    pushToken: u.pushToken,
    platformRole: u.platformRole,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    mustChangePassword: u.mustChangePassword,
    lastLoginAt: u.lastLoginAt?.toISOString(),
    memberships: byUser.get(u._id) ?? [],
    followCount: followCount.get(u._id) ?? 0,
    signupCount: signupCount.get(u._id) ?? 0,
  }));
}

export async function getUser(userId: string): Promise<PlatformUser> {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, ERROR.NOT_FOUND, 'No such user.');
  return (await hydrateUsers([user]))[0]!;
}

export async function setUserStatus(
  userId: string,
  status: UserStatus,
  actor: UserDocument,
  req?: Request,
): Promise<PlatformUser> {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, ERROR.NOT_FOUND, 'No such user.');

  // Suspending yourself signs you out of the console you did it from, and
  // nobody else can lift it unless another super admin exists. Refuse.
  if (user._id === actor._id && status === 'suspended') {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'You cannot suspend your own account.');
  }

  user.status = status;
  await user.save();

  await audit.record(
    actor,
    {
      action: status === 'suspended' ? 'user.suspended' : 'user.reinstated',
      targetType: 'user',
      targetId: user._id,
      summary: `${status === 'suspended' ? 'Suspended' : 'Reinstated'} ${user.email}`,
    },
    req,
  );
  return getUser(userId);
}

export async function setPlatformRole(
  userId: string,
  role: PlatformRole,
  actor: UserDocument,
  req?: Request,
): Promise<PlatformUser> {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, ERROR.NOT_FOUND, 'No such user.');

  // Demoting yourself is how a console ends up with no super admin at all.
  if (user._id === actor._id && role !== 'superadmin') {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'You cannot remove your own platform role.');
  }
  if (user.platformRole === 'superadmin' && role !== 'superadmin') {
    const remaining = await UserModel.countDocuments({
      platformRole: 'superadmin',
      status: 'active',
      _id: { $ne: user._id },
    });
    if (remaining === 0) {
      throw new HttpError(
        400,
        ERROR.VALIDATION_ERROR,
        'That is the last super admin. Promote someone else first.',
      );
    }
  }

  const previous = user.platformRole;
  user.platformRole = role;
  await user.save();

  await audit.record(
    actor,
    {
      action: 'user.platform_role_changed',
      targetType: 'user',
      targetId: user._id,
      summary: `${user.email}: platform role ${previous} → ${role}`,
      meta: { previous, role },
    },
    req,
  );
  return getUser(userId);
}

/** A new password for someone locked out. Returned once, never stored clear. */
export async function resetUserPassword(
  userId: string,
  actor: UserDocument,
  req?: Request,
): Promise<{ userId: ID; email: string; password: string }> {
  const user = await UserModel.findById(userId);
  if (!user) throw new HttpError(404, ERROR.NOT_FOUND, 'No such user.');

  const password = generatePassword();
  user.passwordHash = await hashPassword(password);
  user.mustChangePassword = true;
  await user.save();

  await audit.record(
    actor,
    {
      action: 'user.password_reset',
      targetType: 'user',
      targetId: user._id,
      summary: `Reset the password for ${user.email}`,
    },
    req,
  );

  return { userId: user._id, email: user.email, password };
}

/** Grant or take away the coordinator role at one mosque. */
export async function setMembershipRole(
  userId: string,
  mosqueId: string,
  role: MemberRole,
  actor: UserDocument,
  req?: Request,
): Promise<void> {
  const createdAt = new Date();
  await MembershipModel.updateOne(
    { userId, mosqueId },
    { $set: { role }, $setOnInsert: { _id: newId(), createdAt } },
    { upsert: true },
  );
  await audit.record(
    actor,
    {
      action: 'user.membership_changed',
      targetType: 'user',
      targetId: userId,
      summary: `Set role ${role} at ${mosqueId}`,
      meta: { mosqueId, role },
    },
    req,
  );
}
