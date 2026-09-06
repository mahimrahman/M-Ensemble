import { Router } from 'express';
import {
  followMosque,
  getDashboard,
  getIqamah,
  getMemberDetail,
  getMembers,
  getMosque,
  getOutcomes,
  getPrayerTimes,
  getRoster,
  listMosquePosts,
  listMosques,
  postBroadcast,
  putIqamah,
  putMemberRole,
  unfollowMosque,
  updateMosque,
} from '../controllers/mosque.controller.js';
import {
  broadcastSchema,
  iqamahConfigSchema,
  memberRoleSchema,
  updateMosqueSchema,
} from '../schemas/mosque.schema.js';
import {
  mosquePostsQuerySchema,
  prayerTimesQuerySchema,
  rosterQuerySchema,
} from '../schemas/query.schema.js';
import { fromParam, requireAdmin, requireAdminIf } from '../middleware/requireAdmin.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const mosqueRouter = Router();

const admin = requireAdmin(fromParam('id'));

mosqueRouter.get('/', asyncHandler(listMosques));
mosqueRouter.get('/:id', asyncHandler(getMosque));

// The coordinator edits their own mosque's profile — descriptive fields only.
mosqueRouter.patch(
  '/:id',
  admin,
  validate(updateMosqueSchema, 'body'),
  asyncHandler(updateMosque),
);

mosqueRouter.post('/:id/follow', asyncHandler(followMosque));
mosqueRouter.delete('/:id/follow', asyncHandler(unfollowMosque));

// One path, two audiences: any member without the flag, admin with it. Express
// can't route on a query string, so the guard is conditional instead.
mosqueRouter.get(
  '/:id/posts',
  validate(mosquePostsQuerySchema, 'query'),
  // `validate` has already coerced ?all= to a boolean on req.query.
  requireAdminIf((req) => (req.query as unknown as { all: boolean }).all, fromParam('id')),
  asyncHandler(listMosquePosts),
);

mosqueRouter.get(
  '/:id/prayer-times',
  validate(prayerTimesQuerySchema, 'query'),
  asyncHandler(getPrayerTimes),
);

mosqueRouter.get('/:id/iqamah', asyncHandler(getIqamah));
mosqueRouter.put('/:id/iqamah', admin, validate(iqamahConfigSchema), asyncHandler(putIqamah));

mosqueRouter.get('/:id/dashboard', admin, asyncHandler(getDashboard));
mosqueRouter.get(
  '/:id/roster',
  admin,
  validate(rosterQuerySchema, 'query'),
  asyncHandler(getRoster),
);
mosqueRouter.get('/:id/members', admin, asyncHandler(getMembers));
mosqueRouter.get('/:id/members/:userId', admin, asyncHandler(getMemberDetail));
mosqueRouter.put(
  '/:id/members/:userId/role',
  admin,
  validate(memberRoleSchema),
  asyncHandler(putMemberRole),
);
mosqueRouter.get('/:id/outcomes', admin, asyncHandler(getOutcomes));

// Write to every follower. Admin-gated on the mosque in the path — the sender
// is whoever holds the token, never a body field.
mosqueRouter.post(
  '/:id/notifications',
  admin,
  validate(broadcastSchema),
  asyncHandler(postBroadcast),
);
