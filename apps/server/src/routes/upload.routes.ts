import { Router } from 'express';
import { uploadPosterImage } from '../controllers/upload.controller.js';
import { fromBody, requireAdmin } from '../middleware/requireAdmin.js';
import { uploadErrors, uploadPoster } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const uploadRouter = Router();

/**
 * The order here is the whole access story, and it only works one way round.
 *
 * `requireAdmin(fromBody('mosqueId'))` reads `req.body`, which does not exist
 * until multer has parsed the multipart stream — so the file is necessarily
 * received before we know who is allowed to send it. The size cap is what
 * makes that acceptable: the most an authenticated non-admin can do is spend
 * 8MB of memory and get a 403, and nothing is written to disk until the
 * controller runs, behind the guard.
 */
uploadRouter.post(
  '/poster',
  uploadPoster,
  uploadErrors,
  requireAdmin(fromBody('mosqueId')),
  asyncHandler(uploadPosterImage),
);
