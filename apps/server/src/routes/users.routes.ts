import { Router } from 'express';
import type { PublicUser } from '@m-ensemble/shared';
import { UserModel } from '../models/User.js';
import { userIdsQuerySchema } from '../schemas/me.schema.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/respond.js';

/**
 * `GET /users?ids=a,b,c` — names for a signup list, and nothing else.
 * **Never email.** Unknown ids are dropped silently rather than 404ing; the
 * caller is rendering a list and a missing person just doesn't appear.
 */
export const usersRouter = Router();

usersRouter.get(
  '/',
  validate(userIdsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { ids } = req.query as unknown as { ids: string[] };
    if (ids.length === 0) {
      ok(res, [] as PublicUser[]);
      return;
    }

    const users = await UserModel.find({ _id: { $in: ids } }).select('_id name');
    ok(
      res,
      users.map<PublicUser>((u) => ({ _id: u._id, name: u.name })),
    );
  }),
);
