/**
 * Multipart parsing for the one endpoint that takes a file.
 *
 * **Memory storage, not disk.** Multer's disk engine writes the raw upload
 * straight to a temp file and hands you a path — which would mean the
 * unvalidated original hits the filesystem before anything has established it
 * is an image, and a cleanup path for every way the request can fail after
 * that. Holding it in memory keeps the only write in `storePoster`, after
 * `sharp` has re-encoded it: nothing untrusted is ever on disk. The size cap
 * is what makes that safe, so the two belong together.
 */

import multer from 'multer';
import type { ErrorRequestHandler } from 'express';
import { HttpError } from './errorHandler.js';
import { ERROR } from '../utils/errors.js';

/**
 * The most one poster may weigh on the wire.
 *
 * A recent phone's 12MP JPEG is 3–5MB, and the app downscales before it sends,
 * so 8MB is generous for anything genuine while still bounding what one
 * request can make the server hold in memory.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|avif)$/;

export const uploadPoster = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  // A first pass only. The client writes this header, so it is a way to reject
  // an obvious mistake early and cheaply — `sharp` is what actually decides
  // whether the bytes are an image.
  fileFilter: (_req, file, cb) => {
    if (ACCEPTED.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, ERROR.VALIDATION_ERROR, 'Posters must be a JPEG, PNG, WebP or HEIC.'));
  },
}).single('image');

/**
 * Multer throws `MulterError`, which the generic handler would turn into a 500
 * — "something went wrong" for a file the user can see is simply too big.
 * Mount this directly behind the upload middleware so the size cap reports
 * itself as the 400 it is.
 */
export const uploadErrors: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `That image is over ${MAX_UPLOAD_BYTES / 1024 / 1024}MB. Try a smaller one.`
        : 'That upload could not be read.';
    next(new HttpError(400, ERROR.VALIDATION_ERROR, message));
    return;
  }
  next(err);
};
