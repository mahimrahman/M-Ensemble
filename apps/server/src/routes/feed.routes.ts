import { Router } from 'express';
import type { PostType } from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { PostModel } from '../models/Post.js';
import { currentUser } from '../middleware/requireAuth.js';
import { feedQuerySchema } from '../schemas/query.schema.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { liveFilter } from '../utils/time.js';
import { ok } from '../utils/respond.js';

/**
 * The unified feed across the mosques you follow.
 *
 * Scope is `?mosques` when the app sends it (the Mosques tab filters by city
 * client-side and passes ids through), otherwise everything you follow. Live
 * posts only, soonest first.
 */
export const feedRouter = Router();

feedRouter.get(
  '/',
  validate(feedQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { types, mosques } = req.query as unknown as { types: PostType[]; mosques: string[] };

    let scope = mosques;
    if (scope.length === 0) {
      const follows = await FollowModel.find({ userId: user._id });
      scope = follows.map((f) => f.mosqueId);
    }

    if (scope.length === 0) {
      ok(res, []);
      return;
    }

    const posts = await PostModel.find({
      mosqueId: { $in: scope },
      ...(types.length ? { type: { $in: types } } : {}),
      ...liveFilter(new Date()),
    }).sort({ startAt: 1 });

    ok(
      res,
      posts.map((p) => p.toJSON()),
    );
  }),
);
