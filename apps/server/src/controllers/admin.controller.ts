import type { Request, Response } from 'express';
import type {
  AdminCreateEventInput,
  CreateMosqueInput,
  CoordinatorInput,
  MemberRole,
  PlatformRole,
  UserStatus,
} from '@m-ensemble/shared';
import { PostModel } from '../models/Post.js';
import { MosqueModel } from '../models/Mosque.js';
import { currentUser } from '../middleware/requireAuth.js';
import * as platform from '../services/platform.service.js';
import * as provisioning from '../services/provisioning.service.js';
import * as audit from '../services/audit.service.js';
import { fanOutNewPost } from '../services/push.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { ok, okNull } from '../utils/respond.js';

/**
 * The super admin's own screens: the overview, mosques, people, publishing on
 * a mosque's behalf, and the audit log.
 *
 * Every handler here is mounted behind `requirePlatform` or `requireSuperAdmin`
 * — see `admin.routes.ts` for which is which. Nothing in this file re-checks
 * the role, because a guard that is sometimes in the route and sometimes in the
 * handler is one that eventually gets left out of both.
 */

/** Who the dashboard is signed in as, and what it may therefore render. */
export async function getSession(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  ok(res, {
    userId: user._id,
    name: user.name,
    email: user.email,
    platformRole: user.platformRole,
  });
}

export async function getOverview(_req: Request, res: Response): Promise<void> {
  ok(res, await platform.buildOverview());
}

// ─── Mosques ────────────────────────────────────────────────────────────────

export async function listMosques(req: Request, res: Response): Promise<void> {
  ok(res, await platform.listMosques(req.query as never));
}

export async function getMosque(req: Request, res: Response): Promise<void> {
  ok(res, await platform.mosqueDetail(String(req.params.id)));
}

export async function createMosque(req: Request, res: Response): Promise<void> {
  const created = await provisioning.createMosque(
    req.body as CreateMosqueInput,
    currentUser(req),
    req,
  );
  ok(res, created, 201);
}

/**
 * Mint or reset the account that runs a mosque.
 *
 * The response carries the plaintext password, and it is **the only time it is
 * readable** — nothing stores it and nothing logs it, so a lost one is reset
 * rather than looked up.
 */
export async function issueCredential(req: Request, res: Response): Promise<void> {
  const credential = await provisioning.issueCoordinatorCredential(
    String(req.params.id),
    req.body as CoordinatorInput,
    currentUser(req),
    req,
  );
  ok(res, credential, 201);
}

export async function revokeCoordinator(req: Request, res: Response): Promise<void> {
  await provisioning.revokeCoordinator(
    String(req.params.id),
    String(req.params.userId),
    currentUser(req),
    req,
  );
  okNull(res);
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function listUsers(req: Request, res: Response): Promise<void> {
  ok(res, await provisioning.listUsers(req.query as never));
}

export async function getUser(req: Request, res: Response): Promise<void> {
  ok(res, await provisioning.getUser(String(req.params.id)));
}

export async function setUserStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body as { status: UserStatus };
  ok(res, await provisioning.setUserStatus(String(req.params.id), status, currentUser(req), req));
}

export async function setPlatformRole(req: Request, res: Response): Promise<void> {
  const { platformRole } = req.body as { platformRole: PlatformRole };
  ok(
    res,
    await provisioning.setPlatformRole(String(req.params.id), platformRole, currentUser(req), req),
  );
}

export async function setMembershipRole(req: Request, res: Response): Promise<void> {
  const { mosqueId, role } = req.body as { mosqueId: string; role: MemberRole };
  await provisioning.setMembershipRole(
    String(req.params.id),
    mosqueId,
    role,
    currentUser(req),
    req,
  );
  ok(res, await provisioning.getUser(String(req.params.id)));
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  ok(res, await provisioning.resetUserPassword(String(req.params.id), currentUser(req), req));
}

// ─── Publishing on a mosque's behalf ────────────────────────────────────────

/**
 * Create an event, class, volunteer request or announcement for a mosque the
 * super admin does not coordinate.
 *
 * This is how a mosque gets its first three events without anybody having to
 * teach them the app on day one, and how we fix a listing somebody got wrong
 * before it goes out to two thousand phones.
 *
 * **`createdBy` is the super admin, not the mosque.** The post shows as the
 * mosque's, because that is whose noticeboard it is, but the record of who
 * actually typed it stays honest — and the audit log says so too.
 */
export async function createEvent(req: Request, res: Response): Promise<void> {
  const actor = currentUser(req);
  const input = req.body as AdminCreateEventInput;

  const mosque = await MosqueModel.findById(input.mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');

  const post = await PostModel.create({
    mosqueId: input.mosqueId,
    type: input.type,
    title: input.title,
    description: input.description,
    category: input.category,
    location: input.location,
    slotsNeeded: input.slotsNeeded,
    capacity: input.capacity,
    imageUrl: input.imageUrl,
    _id: newId(),
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    slotsFilled: 0,
    createdBy: actor._id,
    createdAt: new Date(),
  });

  await audit.record(
    actor,
    {
      action: 'post.created_on_behalf',
      targetType: 'post',
      targetId: post._id,
      summary: `Published "${post.title}" for ${mosque.name}`,
      meta: { mosqueId: mosque._id, type: post.type, notify: input.notify !== false },
    },
    req,
  );

  ok(res, post.toJSON(), 201);

  // After the response, never blocking it — the same rule as the coordinator's
  // own create. A slow Expo call must not make the button feel broken.
  if (input.notify !== false) {
    void fanOutNewPost(post).catch((err) => console.error('[push] fan-out failed', err));
  }
}

/** Cancel any post on the platform. Idempotent — the first date sticks. */
export async function cancelPost(req: Request, res: Response): Promise<void> {
  const post = await PostModel.findById(String(req.params.id));
  if (!post) throw new HttpError(404, ERROR.NOT_FOUND, 'That post no longer exists.');

  if (!post.cancelledAt) {
    post.cancelledAt = new Date();
    await post.save();
    await audit.record(
      currentUser(req),
      {
        action: 'post.cancelled',
        targetType: 'post',
        targetId: post._id,
        summary: `Cancelled "${post.title}"`,
        meta: { mosqueId: post.mosqueId },
      },
      req,
    );
  }
  ok(res, post.toJSON());
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export async function listAudit(req: Request, res: Response): Promise<void> {
  ok(res, await audit.list(req.query as never));
}
