import { Router } from 'express';
import {
  cancelPost,
  checkIn,
  createPost,
  deleteLike,
  getPost,
  getPostSignups,
  postLike,
  signUpForPost,
  updatePost,
  withdrawFromPost,
} from '../controllers/post.controller.js';
import { checkInSchema, createPostSchema, updatePostSchema } from '../schemas/post.schema.js';
import { fromBody, fromPost, requireAdmin } from '../middleware/requireAdmin.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const postRouter = Router();

// validate first, so `fromBody('mosqueId')` is guaranteed a string.
postRouter.post(
  '/',
  validate(createPostSchema),
  requireAdmin(fromBody('mosqueId')),
  asyncHandler(createPost),
);

postRouter.get('/:id', asyncHandler(getPost));
postRouter.patch(
  '/:id',
  validate(updatePostSchema),
  requireAdmin(fromPost),
  asyncHandler(updatePost),
);
postRouter.post('/:id/cancel', requireAdmin(fromPost), asyncHandler(cancelPost));

postRouter.post('/:id/like', asyncHandler(postLike));
postRouter.delete('/:id/like', asyncHandler(deleteLike));

postRouter.post('/:id/signup', asyncHandler(signUpForPost));
postRouter.delete('/:id/signup', asyncHandler(withdrawFromPost));
postRouter.get('/:id/signups', asyncHandler(getPostSignups));

// Not `requireAdmin`: self check-in is allowed, and the controller decides.
postRouter.post('/:id/checkin', validate(checkInSchema), asyncHandler(checkIn));
