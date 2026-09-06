import type { Request, Response } from 'express';
import type {
  DateString,
  MemberRole,
  MosqueIqamahConfig,
  PostType,
  UpdateMosqueInput,
} from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MosqueModel } from '../models/Mosque.js';
import { PostModel } from '../models/Post.js';
import { currentUser } from '../middleware/requireAuth.js';
import { buildDashboard } from '../services/dashboard.service.js';
import { buildMemberDetail, buildMembers, setMemberRole } from '../services/members.service.js';
import { buildOutcomes } from '../services/outcomes.service.js';
import { buildRoster } from '../services/roster.service.js';
import * as prayer from '../services/prayer.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { liveFilter } from '../utils/time.js';
import { ok, okNull } from '../utils/respond.js';

export async function listMosques(_req: Request, res: Response): Promise<void> {
  const mosques = await MosqueModel.find();
  ok(
    res,
    mosques.map((m) => m.toJSON()),
  );
}

export async function getMosque(req: Request, res: Response): Promise<void> {
  const mosque = await MosqueModel.findById(String(req.params.id));
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'Mosque not found.');
  ok(res, mosque.toJSON());
}

/**
 * Edit the mosque's own profile.
 *
 * Only the descriptive half: bio, history, contact and the services list.
 * Name, address, coordinates and joinCode are identity — letting them be
 * patched from the app would let one mosque rename itself as another. An empty
 * string clears the field rather than storing "".
 */
export async function updateMosque(req: Request, res: Response): Promise<void> {
  const mosque = await MosqueModel.findById(String(req.params.id));
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'Mosque not found.');

  const patch = req.body as UpdateMosqueInput;

  if (patch.bio !== undefined) mosque.bio = patch.bio.trim() || undefined;
  if (patch.history !== undefined) mosque.history = patch.history.trim() || undefined;
  if (patch.website !== undefined) {
    // Store the bare host; the app adds the scheme when it opens the link.
    mosque.website = patch.website.trim().replace(/^https?:\/\//i, '') || undefined;
  }
  if (patch.phone !== undefined) mosque.phone = patch.phone.trim() || undefined;
  if (patch.services !== undefined) {
    const cleaned = patch.services.map((s) => s.trim()).filter(Boolean);
    mosque.services = cleaned.length ? cleaned : undefined;
  }

  await mosque.save();
  ok(res, mosque.toJSON());
}

/** Idempotent — the onboarding screen toggles this freely. */
export async function followMosque(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const mosqueId = String(req.params.id);

  await FollowModel.findOneAndUpdate(
    { userId: user._id, mosqueId },
    { $setOnInsert: { _id: newId(), createdAt: new Date() } },
    { upsert: true },
  );
  okNull(res);
}

export async function unfollowMosque(req: Request, res: Response): Promise<void> {
  await FollowModel.deleteOne({ userId: currentUser(req)._id, mosqueId: String(req.params.id) });
  okNull(res);
}

/**
 * Live posts by default; `?all=true` is the admin view and includes past and
 * cancelled ones. `requireAdminIf` on the route enforces the role for the
 * second case only.
 *
 * Note this deliberately does **not** 404 on an unknown mosque — it returns
 * `[]`, matching the mock. `GET /mosques/:id/iqamah` does 404. The asymmetry is
 * intentional; don't tidy it.
 */
export async function listMosquePosts(req: Request, res: Response): Promise<void> {
  const mosqueId = String(req.params.id);
  const { all } = req.query as unknown as { all: boolean };

  const posts = await PostModel.find({
    mosqueId,
    ...(all ? {} : liveFilter(new Date())),
  }).sort({ startAt: 1 });

  ok(
    res,
    posts.map((p) => p.toJSON()),
  );
}

export async function getPrayerTimes(req: Request, res: Response): Promise<void> {
  const { date } = req.query as unknown as { date: DateString };
  ok(res, await prayer.getPrayerTable(String(req.params.id), date));
}

export async function getIqamah(req: Request, res: Response): Promise<void> {
  ok(res, await prayer.getIqamahConfig(String(req.params.id)));
}

export async function putIqamah(req: Request, res: Response): Promise<void> {
  const input = req.body as MosqueIqamahConfig;
  ok(res, await prayer.setIqamahConfig(String(req.params.id), input));
}

export async function getDashboard(req: Request, res: Response): Promise<void> {
  ok(res, await buildDashboard(String(req.params.id)));
}

export async function getRoster(req: Request, res: Response): Promise<void> {
  const { upcoming, types, post } = req.query as unknown as {
    upcoming: boolean;
    types: PostType[];
    post?: string;
  };
  ok(res, await buildRoster(String(req.params.id), { upcoming, types, post }));
}

export async function getMembers(req: Request, res: Response): Promise<void> {
  ok(res, await buildMembers(String(req.params.id)));
}

export async function getMemberDetail(req: Request, res: Response): Promise<void> {
  ok(res, await buildMemberDetail(String(req.params.id), String(req.params.userId)));
}

export async function putMemberRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role: MemberRole };
  const member = await setMemberRole(
    String(req.params.id),
    currentUser(req)._id,
    String(req.params.userId),
    role,
  );
  ok(res, member);
}

export async function getOutcomes(req: Request, res: Response): Promise<void> {
  ok(res, await buildOutcomes(String(req.params.id)));
}
