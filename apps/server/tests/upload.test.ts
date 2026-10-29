import { rm } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';
import { env } from '../src/config/env.js';
import { MAX_UPLOAD_BYTES } from '../src/middleware/upload.js';
import { UploadModel } from '../src/models/Upload.js';
import {
  MAX_DIMENSION,
  S3Storage,
  UPLOAD_QUOTA_CODE,
  isOurUploadUrl,
  setDailyQuotaForTests,
  uploadDir,
} from '../src/services/upload.service.js';
import { KHADIJA_ADMIN_ID } from '../src/shared.js';

const KHADIJA = 'mosque_khadija'; // Amina administers this one; Yusuf does not.

/** A real image, generated rather than committed — 2000px wide, so it must be downscaled. */
function tallImage(width = 2000, height = 1200): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 82, b: 71 } },
  })
    .png()
    .toBuffer();
}

function upload(token: string, mosqueId: string, file: Buffer, name = 'poster.png') {
  return api
    .post('/api/uploads/poster')
    .set('Authorization', `Bearer ${token}`)
    .field('mosqueId', mosqueId)
    .attach('image', file, name);
}

// The suite writes real files; UPLOAD_DIR points at tests/.uploads (see
// vitest.config.ts) so this only ever removes a scratch folder.
afterAll(async () => {
  await rm(uploadDir, { recursive: true, force: true });
});

// Any test that lowers the quota puts it back, or the next file's uploads 429.
afterEach(() => {
  setDailyQuotaForTests(env.UPLOAD_DAILY_QUOTA);
});

describe('POST /uploads/poster', () => {
  it('stores an image and hands back a server-relative path', async () => {
    const token = await tokenFor(AMINA);
    const res = await upload(token, KHADIJA, await tallImage()).expect(201);

    expect(res.body.data.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/);

    // Downscaled to the width the app renders at, and re-encoded as JPEG
    // whatever went in — a 2000px PNG must not come back out as one.
    expect(res.body.data.width).toBe(1200);
    expect(res.body.data.height).toBe(720);

    // And it is actually on disk, and actually a JPEG.
    const file = path.join(uploadDir, path.basename(res.body.data.url));
    expect((await sharp(file).metadata()).format).toBe('jpeg');
  });

  it('serves the stored path back, cacheable and loadable cross-origin', async () => {
    const token = await tokenFor(AMINA);
    const { url } = (await upload(token, KHADIJA, await tallImage()).expect(201)).body.data;

    // Served outside /api, so no bearer token — an <img> cannot send one.
    const res = await api.get(url).expect(200);
    expect(res.headers['content-type']).toBe('image/jpeg');

    // Helmet's default same-origin CORP would let the fetch succeed and then
    // stop the browser painting it: the app is never same-origin with this
    // API. Without this header the feature fails only in a real browser,
    // which is exactly the failure a test suite has to catch instead.
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');

    // Filenames are UUIDs and the bytes never change.
    expect(res.headers['cache-control']).toMatch(/immutable/);
  });

  it('leaves an image smaller than the render width alone', async () => {
    const token = await tokenFor(AMINA);
    const res = await upload(token, KHADIJA, await tallImage(400, 300)).expect(201);
    expect(res.body.data.width).toBe(400);
  });

  it('writes a ledger row for the upload', async () => {
    const token = await tokenFor(AMINA);
    const { url, bytes } = (await upload(token, KHADIJA, await tallImage()).expect(201)).body.data;

    const row = await UploadModel.findOne({ url });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(KHADIJA_ADMIN_ID);
    expect(row!.bytes).toBe(bytes);
    expect(row!.width).toBe(1200);
    expect(row!.height).toBe(720);
    expect(row!.createdAt.getTime()).toBeGreaterThan(Date.now() - 10_000);
  });

  it('refuses a member who does not administer the mosque', async () => {
    const token = await tokenFor(YUSUF);
    await upload(token, KHADIJA, await tallImage(100, 100)).expect(403);
  });

  it('refuses an unauthenticated caller', async () => {
    await api
      .post('/api/uploads/poster')
      .field('mosqueId', KHADIJA)
      .attach('image', await tallImage(100, 100), 'poster.png')
      .expect(401);
  });

  it('rejects a file that is not an image, whatever it claims to be', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post('/api/uploads/poster')
      .set('Authorization', `Bearer ${token}`)
      .field('mosqueId', KHADIJA)
      .attach('image', Buffer.from('#!/bin/sh\nrm -rf /'), {
        filename: 'poster.jpg',
        contentType: 'image/jpeg', // the client writes this header, so it can lie
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a file over the size cap', async () => {
    const token = await tokenFor(AMINA);
    const res = await upload(token, KHADIJA, Buffer.alloc(MAX_UPLOAD_BYTES + 1)).expect(400);
    expect(res.body.error.message).toMatch(/8MB/);
  });

  it('rejects an image wider or taller than 8000px before decoding it', async () => {
    const token = await tokenFor(AMINA);
    // A thin strip: tiny on the wire, over the cap on one side. The header is
    // what gets checked, so the file does not need to be large to prove it.
    const wide = await tallImage(MAX_DIMENSION + 1, 8);
    const res = await upload(token, KHADIJA, wide).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/8001×8/);
    expect(res.body.error.message).toMatch(/8000×8000/);

    // Nothing was stored, and nothing was counted.
    expect(await UploadModel.countDocuments({ userId: KHADIJA_ADMIN_ID })).toBe(0);
  });
});

describe('the daily quota', () => {
  it('refuses the upload after UPLOAD_DAILY_QUOTA in a day, with a 429', async () => {
    setDailyQuotaForTests(2);
    const token = await tokenFor(AMINA);
    const small = await tallImage(100, 100);

    await upload(token, KHADIJA, small).expect(201);
    await upload(token, KHADIJA, small).expect(201);

    const res = await upload(token, KHADIJA, small).expect(429);
    expect(res.body.error.code).toBe(UPLOAD_QUOTA_CODE);
    expect(res.body.error.message).toMatch(/24 hours/);

    // The refused one was not written anywhere.
    expect(await UploadModel.countDocuments({ userId: KHADIJA_ADMIN_ID })).toBe(2);
  });

  it('is a rolling 24-hour window, so yesterday’s uploads do not count', async () => {
    setDailyQuotaForTests(1);
    const token = await tokenFor(AMINA);

    // Back-date a row to 25 hours ago, as if it were uploaded yesterday.
    await UploadModel.create({
      _id: 'upload_old',
      userId: KHADIJA_ADMIN_ID,
      url: '/uploads/00000000-0000-4000-8000-000000000000.jpg',
      bytes: 1,
      width: 1,
      height: 1,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    await upload(token, KHADIJA, await tallImage(100, 100)).expect(201);
  });

  it('does not apply to a super admin', async () => {
    setDailyQuotaForTests(1);
    const login = await api
      .post('/api/auth/login')
      .send({ email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD })
      .expect(200);
    const token = login.body.data.token as string;
    const small = await tallImage(100, 100);

    await upload(token, KHADIJA, small).expect(201);
    await upload(token, KHADIJA, small).expect(201);
  });
});

describe('isOurUploadUrl', () => {
  const uuid = '3f2c9a7e-1b4d-4c8e-9f0a-6d5e4c3b2a10';
  const cdn = 'https://cdn.mensemble.ca';

  it('accepts the path LocalDiskStorage mints', () => {
    expect(isOurUploadUrl(`/uploads/${uuid}.jpg`)).toBe(true);
  });

  it('accepts the URL S3Storage mints, under the configured public base only', () => {
    expect(isOurUploadUrl(`${cdn}/posters/2026/10/${uuid}.jpg`, cdn)).toBe(true);
    // A base with a path of its own.
    expect(isOurUploadUrl(`${cdn}/media/posters/2026/10/${uuid}.jpg`, `${cdn}/media/`)).toBe(true);

    // The same URL with no bucket configured is somebody else's host.
    expect(isOurUploadUrl(`${cdn}/posters/2026/10/${uuid}.jpg`, undefined)).toBe(false);
    // A look-alike origin, a different scheme, a query string.
    expect(isOurUploadUrl(`https://cdn.mensemble.ca.evil.net/posters/2026/10/${uuid}.jpg`, cdn)).toBe(false);
    expect(isOurUploadUrl(`http://cdn.mensemble.ca/posters/2026/10/${uuid}.jpg`, cdn)).toBe(false);
    expect(isOurUploadUrl(`${cdn}/posters/2026/10/${uuid}.jpg?x=1`, cdn)).toBe(false);
    // Our origin, but not a key this service writes.
    expect(isOurUploadUrl(`${cdn}/posters/2026/10/${uuid}.png`, cdn)).toBe(false);
    expect(isOurUploadUrl(`${cdn}/anything/${uuid}.jpg`, cdn)).toBe(false);
  });

  it('refuses everything else', () => {
    expect(isOurUploadUrl('https://example.com/tracker.jpg')).toBe(false);
    expect(isOurUploadUrl('/uploads/../src/index.ts')).toBe(false);
    expect(isOurUploadUrl('/uploads/not-a-uuid.jpg')).toBe(false);
    expect(isOurUploadUrl(`/uploads/${uuid}.png`)).toBe(false);
    expect(isOurUploadUrl(`//evil.example/uploads/${uuid}.jpg`)).toBe(false);
    expect(isOurUploadUrl('')).toBe(false);
  });
});

describe('S3Storage', () => {
  it('puts the object immutable-cached and returns the public URL', async () => {
    const sent: unknown[] = [];
    const store = new S3Storage({
      bucket: 'posters-bucket',
      publicUrl: 'https://cdn.mensemble.ca/', // trailing slash is tolerated
      client: {
        async send(cmd) {
          sent.push(cmd);
        },
      },
    });

    const url = await store.put('posters/2026/10/abc.jpg', Buffer.from('jpeg'), 'image/jpeg');
    expect(url).toBe('https://cdn.mensemble.ca/posters/2026/10/abc.jpg');

    const put = sent[0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({
      Bucket: 'posters-bucket',
      Key: 'posters/2026/10/abc.jpg',
      ContentType: 'image/jpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await store.delete('posters/2026/10/abc.jpg');
    const del = sent[1] as DeleteObjectCommand;
    expect(del).toBeInstanceOf(DeleteObjectCommand);
    expect(del.input).toMatchObject({ Bucket: 'posters-bucket', Key: 'posters/2026/10/abc.jpg' });
  });
});

describe('imageUrl on a post', () => {
  it('accepts a path this server minted, and refuses anything else', async () => {
    const token = await tokenFor(AMINA);
    const { url } = (await upload(token, KHADIJA, await tallImage()).expect(201)).body.data;

    const base = {
      mosqueId: KHADIJA,
      type: 'event' as const,
      title: 'Community iftar',
      description: 'Everyone welcome.',
      category: 'Community',
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 90_000_000).toISOString(),
      location: 'Main hall',
    };

    const created = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, imageUrl: url })
      .expect(201);
    expect(created.body.data.imageUrl).toBe(url);

    // An off-site URL would let one admin point every reader's app at a host
    // they control, so the field only ever holds one of our own paths.
    await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...base, imageUrl: 'https://example.com/tracker.jpg' })
      .expect(400);
  });

  it('removes the poster when the patch sends null', async () => {
    const token = await tokenFor(AMINA);
    const { url } = (await upload(token, KHADIJA, await tallImage()).expect(201)).body.data;

    const created = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mosqueId: KHADIJA,
        type: 'announcement' as const,
        title: 'Notice',
        description: 'Text.',
        category: 'Community',
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86_400_000).toISOString(),
        location: 'Mosque',
        imageUrl: url,
      })
      .expect(201);

    const patched = await api
      .patch(`/api/posts/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ imageUrl: null })
      .expect(200);

    expect(patched.body.data.imageUrl).toBeUndefined();
  });
});
