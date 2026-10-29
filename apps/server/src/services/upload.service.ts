/**
 * Where an uploaded poster goes.
 *
 * Every byte passes through `storePoster`, never a route: one `sharp` pipeline
 * normalises the image, then a `StorageBackend` writes it. There are two
 * backends and the environment picks one at boot:
 *
 * - **`LocalDiskStorage`** — the laptop default. Files land under `UPLOAD_DIR`
 *   and `express.static` serves them at `/uploads/<uuid>.jpg`. Nothing to sign
 *   up for; it works the moment the server starts. The cost is that the files
 *   live with the process, so a container loses them on redeploy — which is
 *   why `assertProductionConfig` refuses to start in production without S3.
 * - **`S3Storage`** — any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO),
 *   chosen when `hasS3`. Objects are keyed `posters/<yyyy>/<mm>/<uuid>.jpg`
 *   and the stored URL is `${S3_PUBLIC_URL}/<key>`: absolute, because the
 *   bucket is a different host from the API.
 *
 * **The stored URL is relative on disk and absolute on S3**, and both are
 * accepted downstream by `isOurUploadUrl`. The relative form matters on a
 * laptop: this API is reached at a different address from every machine that
 * talks to it (localhost, the LAN IP, the test harness) and the app resolves a
 * path against whichever base URL it is already using. The absolute form is
 * fine because a CDN host is the same from everywhere.
 */

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp, { type OutputInfo } from 'sharp';
import { env, hasS3 } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';
import { UploadModel } from '../models/Upload.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { logger } from '../utils/logger.js';

/**
 * Matches the bundled posters, which are 1200px wide — see the header of
 * `scripts/build-poster-assets.js` for why that is the number. A phone camera
 * hands us 3–4000px and the app never renders above 1200, so the rest is
 * bandwidth spent on nothing.
 */
const MAX_WIDTH = 1200;

/** Quality 82 with mozjpeg is where the artefacts stop being visible at this size. */
const JPEG_QUALITY = 82;

/**
 * The largest image we will decode, per side.
 *
 * The 8MB wire cap bounds the *compressed* size; a PNG that is 8MB on the wire
 * can be 30,000px square and decode to gigabytes. Reading the header first and
 * refusing anything over this keeps one request from taking the process down.
 * 8000px is twice a modern phone camera, so nothing genuine is refused.
 */
export const MAX_DIMENSION = 8000;

/** The absolute directory posters are written to. Relative paths resolve from the repo. */
export const uploadDir = path.resolve(env.UPLOAD_DIR);

/** The URL prefix `express.static` serves `uploadDir` at. */
export const UPLOAD_ROUTE = '/uploads';

/** The error code a 429 from the quota carries. Not in `ERROR` because only this service emits it. */
export const UPLOAD_QUOTA_CODE = 'UPLOAD_QUOTA';

export interface StoredPoster {
  /** `/uploads/<uuid>.jpg` on disk, `https://…/posters/…/<uuid>.jpg` on S3 — what goes in `Post.imageUrl`. */
  url: string;
  width: number;
  height: number;
  bytes: number;
}

// ─── Storage backends ───────────────────────────────────────────────────────

export interface StorageBackend {
  /** Writes the object and returns the URL it is now readable at. */
  put(key: string, bytes: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
}

/** Today's behaviour: a flat directory served by `express.static`. */
export class LocalDiskStorage implements StorageBackend {
  constructor(private readonly dir: string = uploadDir) {}

  async put(key: string, bytes: Buffer): Promise<string> {
    // Cheap and idempotent, and it means an upload cannot fail on a missing
    // folder in a process that never ran the boot hook — the test harness
    // builds the app with `createApp()` and never calls `main()`.
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, key), bytes);
    return `${UPLOAD_ROUTE}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await rm(path.join(this.dir, key), { force: true });
  }
}

/** The subset of `S3Client` this service calls, so a test can hand in a fake. */
export interface S3Sender {
  send(command: PutObjectCommand | DeleteObjectCommand): Promise<unknown>;
}

export interface S3StorageOptions {
  bucket: string;
  /** Where the bucket is readable from — a CDN or the R2 public domain. */
  publicUrl: string;
  client?: S3Sender;
}

/**
 * Any S3-compatible bucket.
 *
 * `forcePathStyle` is on whenever a custom endpoint is set: R2 and MinIO
 * address a bucket as `endpoint/bucket/key`, and the SDK's default of
 * `bucket.endpoint/key` resolves to a host that does not exist. On AWS proper
 * there is no endpoint, so the default stays.
 */
export class S3Storage implements StorageBackend {
  private readonly client: S3Sender;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(opts: S3StorageOptions) {
    this.bucket = opts.bucket;
    this.publicUrl = opts.publicUrl.replace(/\/+$/, '');
    this.client =
      opts.client ??
      new S3Client({
        region: env.S3_REGION,
        ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
        credentials: {
          accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
        },
      });
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        // Keys are UUIDs and the bytes never change, so a CDN and every browser
        // may keep the object for a year without asking again. A new poster is
        // a new key.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

/**
 * The backend the environment selected. `hasS3` already checked that the four
 * S3 variables are all present, so the `!` on each is the same assertion twice.
 */
export const storage: StorageBackend = hasS3
  ? new S3Storage({ bucket: env.S3_BUCKET!, publicUrl: env.S3_PUBLIC_URL! })
  : new LocalDiskStorage();

const backendName = hasS3 ? 's3' : 'disk';

/**
 * The object key for a new poster.
 *
 * Flat on disk, because `express.static` serves `/uploads/<uuid>.jpg` and that
 * is the shape every schema has accepted since the first upload. Date-prefixed
 * in the bucket, because a bucket with 40,000 objects at the root is one
 * nobody can list, and "what was uploaded in March" is a question a billing
 * dispute will eventually ask.
 */
function posterKey(id: string, now = new Date()): string {
  if (!hasS3) return `${id}.jpg`;
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `posters/${yyyy}/${mm}/${id}.jpg`;
}

/** Called once at boot so the first upload isn't the thing that creates the directory. */
export async function ensureUploadDir(): Promise<void> {
  // With a bucket configured the directory may be read-only or absent, and
  // nothing will be written to it — failing to create it must not stop boot.
  if (hasS3) return;
  await mkdir(uploadDir, { recursive: true });
}

// ─── Is this one of ours? ───────────────────────────────────────────────────

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Exactly what `LocalDiskStorage` writes. */
const LOCAL_POSTER = new RegExp(`^${UPLOAD_ROUTE}/${UUID}\\.jpg$`);

/** The key half of what `S3Storage` writes, after the public base. */
const S3_POSTER_KEY = new RegExp(`^/posters/\\d{4}/\\d{2}/${UUID}\\.jpg$`);

/**
 * True for a URL this API itself minted, false for everything else.
 *
 * `imageUrl` and `logoUrl` are rendered by every client that shows the record,
 * so a free-form string would let one admin point every reader's app at any
 * host on the internet — a tracking pixel that collects the IP of everyone who
 * scrolls past, at minimum. The schemas constrain the field to one of the two
 * shapes `storePoster` produces, and the only way to produce one is to upload
 * through the endpoint that checks who you are.
 *
 * The S3 form is accepted only when `S3_PUBLIC_URL` is configured, and only
 * under that exact origin — the host comparison is on the parsed URL, not a
 * prefix, so `https://cdn.example.com.evil.net/posters/…` does not pass.
 *
 * The second argument exists so the two forms can be unit-tested without a
 * bucket; production callers pass the URL alone.
 */
export function isOurUploadUrl(url: string, s3PublicUrl: string | undefined = env.S3_PUBLIC_URL): boolean {
  if (LOCAL_POSTER.test(url)) return true;
  if (!s3PublicUrl) return false;

  let candidate: URL;
  let base: URL;
  try {
    candidate = new URL(url);
    base = new URL(s3PublicUrl);
  } catch {
    return false;
  }
  if (candidate.origin !== base.origin) return false;
  if (candidate.search || candidate.hash || candidate.username) return false;

  // The public base may itself carry a path (`https://cdn.example.com/media`).
  const basePath = base.pathname.replace(/\/+$/, '');
  if (!candidate.pathname.startsWith(basePath)) return false;
  return S3_POSTER_KEY.test(candidate.pathname.slice(basePath.length));
}

// ─── Quota ──────────────────────────────────────────────────────────────────

let dailyQuota = env.UPLOAD_DAILY_QUOTA;

/** `env` is parsed at import time, so a test cannot lower the quota through the environment. */
export function setDailyQuotaForTests(n: number): void {
  dailyQuota = n;
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Refuses the upload when this user has already stored `UPLOAD_DAILY_QUOTA`
 * images in the trailing 24 hours.
 *
 * A rolling window rather than a calendar day, so there is no midnight at
 * which the count resets to zero and a script can double its take. Counted
 * from the `Upload` ledger, so it survives a restart and is shared across
 * replicas — an in-memory counter would be per process and reset on deploy.
 */
export async function assertUnderQuota(userId: string): Promise<void> {
  const since = new Date(Date.now() - DAY_MS);
  const used = await UploadModel.countDocuments({ userId, createdAt: { $gte: since } });
  if (used >= dailyQuota) {
    throw new HttpError(
      429,
      UPLOAD_QUOTA_CODE,
      `You've uploaded ${dailyQuota} images in the last 24 hours, which is the limit. Try again tomorrow.`,
    );
  }
}

/** Writes the ledger row the quota counts. */
export async function recordUpload(userId: string, stored: StoredPoster): Promise<void> {
  await UploadModel.create({
    _id: newId(),
    userId,
    url: stored.url,
    bytes: stored.bytes,
    width: stored.width,
    height: stored.height,
    createdAt: new Date(),
  });
}

// ─── The pipeline ───────────────────────────────────────────────────────────

const NOT_AN_IMAGE = "That file isn't an image we can read. Try a JPEG, PNG, WebP or HEIC.";

/**
 * Normalises one uploaded image and writes it.
 *
 * Everything comes out as JPEG at up to 1200px wide, whatever went in. Four
 * things happen on the way, and each is load-bearing:
 *
 * - `metadata()` reads the header **before** anything is decoded, and refuses
 *   dimensions over `MAX_DIMENSION`. The decode is where the memory goes; the
 *   header is a few hundred bytes.
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
 *
 * `ownerUserId` is for the log line only; the quota and the ledger row are the
 * controller's, which runs them around this call.
 */
export async function storePoster(buffer: Buffer, ownerUserId: string): Promise<StoredPoster> {
  // `limitInputPixels` is the second guard, inside libvips, in case a header
  // lies about its own dimensions.
  const image = sharp(buffer, { limitInputPixels: MAX_DIMENSION * MAX_DIMENSION });

  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = await image.metadata());
  } catch {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, NOT_AN_IMAGE);
  }
  if (!width || !height) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, NOT_AN_IMAGE);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new HttpError(
      400,
      ERROR.VALIDATION_ERROR,
      `That image is ${width}×${height}. The most we accept is ${MAX_DIMENSION}×${MAX_DIMENSION} — export a smaller copy and try again.`,
    );
  }

  let jpeg: Buffer;
  let info: OutputInfo;
  try {
    const result = await image
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    jpeg = result.data;
    info = result.info;
  } catch {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, NOT_AN_IMAGE);
  }

  const key = posterKey(newId());
  const url = await storage.put(key, jpeg, 'image/jpeg');

  logger.info(
    { userId: ownerUserId, backend: backendName, key, bytes: jpeg.length, width: info.width, height: info.height },
    'poster stored',
  );

  return { url, width: info.width, height: info.height, bytes: jpeg.length };
}
