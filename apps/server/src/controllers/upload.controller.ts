import type { Request, Response } from 'express';
import { HttpError } from '../middleware/errorHandler.js';
import { storePoster } from '../services/upload.service.js';
import { ERROR } from '../utils/errors.js';
import { ok } from '../utils/respond.js';

/**
 * `POST /api/uploads/poster` — takes one image, returns the path to store on
 * a post. Uploading and creating the post are separate calls on purpose: the
 * picker runs while the coordinator is still filling in the form, so the slow
 * part is over by the time they press Publish, and an edit can change the
 * poster without resending every other field.
 */
export async function uploadPosterImage(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'No image was attached.');
  }
  ok(res, await storePoster(req.file.buffer), 201);
}

/**
 * `POST /api/uploads/image` — the same pipeline with no mosque attached.
 *
 * A partner's logo and a campaign creative belong to no mosque, so there is
 * nothing to authorise against per-mosque; the route gates this on `superadmin`
 * instead. Identical bytes out — one JPEG, capped at 1200px, metadata stripped
 * — so a caller cannot tell the two endpoints apart from the response, which is
 * the point: there is one image pipeline, not two.
 */
export async function uploadPlatformImage(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'No image was attached.');
  }
  ok(res, await storePoster(req.file.buffer), 201);
}
