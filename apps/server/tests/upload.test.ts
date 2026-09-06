import { rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';
import { MAX_UPLOAD_BYTES } from '../src/middleware/upload.js';
import { uploadDir } from '../src/services/upload.service.js';

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
