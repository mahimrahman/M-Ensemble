/**
 * Where an uploaded poster goes.
 *
 * **Local disk, deliberately.** Images are written under `UPLOAD_DIR` and
 * served back by `express.static` — no bucket, no credentials, nothing to sign
 * up for, and it works the moment the server starts. The cost is that the
 * files live with the process: a container with an ephemeral filesystem loses
 * them on redeploy, so a real deployment needs a mounted volume (or a swap to
 * S3/Cloudinary, which is why every byte goes through `storePoster` rather
 * than being written from the route).
 *
 * **The stored URL is server-relative** (`/uploads/<id>.jpg`), never absolute.
 * An absolute one bakes today's host into the database, and this API is
 * reached at a different address from every machine that talks to it — a
 * laptop on localhost, a phone on the LAN IP, the test harness on 4100. The
 * app resolves the path against whichever base URL it is already using.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OutputInfo } from 'sharp';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';

/**
 * Matches the bundled posters, which are 1200px wide — see the header of
 * `scripts/build-poster-assets.js` for why that is the number. A phone camera
 * hands us 3–4000px and the app never renders above 1200, so the rest is
 * bandwidth spent on nothing.
 */
const MAX_WIDTH = 1200;

/** Quality 82 with mozjpeg is where the artefacts stop being visible at this size. */
const JPEG_QUALITY = 82;

/** The absolute directory posters are written to. Relative paths resolve from the repo. */
export const uploadDir = path.resolve(env.UPLOAD_DIR);

/** The URL prefix `express.static` serves `uploadDir` at. */
export const UPLOAD_ROUTE = '/uploads';

export interface StoredPoster {
  /** Server-relative path — what goes in `Post.imageUrl`. */
  url: string;
  width: number;
  height: number;
  bytes: number;
}

/** Called once at boot so the first upload isn't the thing that creates the directory. */
export async function ensureUploadDir(): Promise<void> {
  await mkdir(uploadDir, { recursive: true });
}

/**
 * Normalises one uploaded image and writes it.
 *
 * Everything comes out as JPEG at up to 1200px wide, whatever went in. Three
 * things happen on the way, and each is load-bearing:
 *
 * - `.rotate()` **before** the resize bakes in the EXIF orientation. Without
 *   it, a photo taken in portrait is stored sideways, because the flag that
 *   said which way up it goes is dropped by the re-encode.
 * - `withoutEnlargement` leaves a small image alone. Upscaling a 400px flyer
 *   to 1200 makes a bigger, blurrier file and nothing else.
 * - Re-encoding drops the metadata, and with it the GPS coordinates phones
 *   write into photos. A mosque posting a picture from inside the building
 *   should not be publishing its location to anyone who downloads the file.
 *
 * A buffer that isn't an image fails here, in `sharp`, not in the mimetype
 * check on the way in — the client controls that header and can lie about it.
 */
export async function storePoster(buffer: Buffer): Promise<StoredPoster> {
  let jpeg: Buffer;
  let info: OutputInfo;
  try {
    const result = await sharp(buffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    jpeg = result.data;
    info = result.info;
  } catch {
    throw new HttpError(
      400,
      ERROR.VALIDATION_ERROR,
      "That file isn't an image we can read. Try a JPEG, PNG, WebP or HEIC.",
    );
  }

  // Cheap and idempotent, and it means an upload cannot fail on a missing
  // folder in a process that never ran the boot hook — the test harness
  // builds the app with `createApp()` and never calls `main()`.
  await ensureUploadDir();

  const name = `${newId()}.jpg`;
  await writeFile(path.join(uploadDir, name), jpeg);

  return {
    url: `${UPLOAD_ROUTE}/${name}`,
    width: info.width,
    height: info.height,
    bytes: jpeg.length,
  };
}
