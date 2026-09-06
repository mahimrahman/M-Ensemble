import { Router } from 'express';
import { uploadPlatformImage, uploadPosterImage } from '../controllers/upload.controller.js';
import { requirePosterUploader } from '../middleware/requireAdmin.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import { uploadErrors, uploadPoster } from '../middleware/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const uploadRouter = Router();

/**
 * The order here is the whole access story, and it only works one way round.
 *
 * The guard reads `req.body`, which does not exist until multer has parsed the
 * multipart stream — so the file is necessarily received before we know who is
 * allowed to send it. The size cap is what makes that acceptable: the most an
 * authenticated non-admin can do is spend 8MB of memory and get a 403, and
 * nothing is written to disk until the controller runs, behind the guard.
 */
uploadRouter.post(
  '/poster',
  uploadPoster,
  uploadErrors,
  // Coordinator of that mosque, **or** a platform super admin. The second case
  // is what lets the console publish an event on a mosque's behalf with a
  // poster — a super admin holds no `Membership` anywhere, so the plain
  // `requireAdmin` would refuse them on every mosque there is.
  requirePosterUploader,
  asyncHandler(uploadPosterImage),
);

/**
 * `POST /api/uploads/image` — the console's upload, with no mosque attached.
 *
 * A partner's logo and a campaign creative belong to no mosque, so there is no
 * `mosqueId` to authorise against and `requireAdmin` has nothing to check. This
 * is the platform's own door, gated on `superadmin` and nothing else.
 *
 * Same pipeline underneath: `sharp` re-encodes to JPEG, strips the metadata and
 * writes one file under a UUID. The only difference is who may call it.
 */
uploadRouter.post(
  '/image',
  uploadPoster,
  uploadErrors,
  requireSuperAdmin,
  asyncHandler(uploadPlatformImage),
);
