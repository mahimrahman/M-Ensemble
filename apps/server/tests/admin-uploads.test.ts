import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { api, tokenFor, AMINA, YUSUF } from './helpers/api.js';
import { AuditEntryModel } from '../src/models/AuditEntry.js';
import { KHADIJA_ID, MADINA_ID } from '../src/shared.js';
import { env } from '../src/config/env.js';

/**
 * The image pipeline, from all three callers.
 *
 * One pipeline, two doors: `/uploads/poster` is mosque-scoped and open to that
 * mosque's coordinator, `/uploads/image` belongs to the platform and is open to
 * a super admin. The interesting cases are the seams between them.
 */

async function superAdminToken(): Promise<string> {
  const res = await api
    .post('/api/auth/login')
    .send({ email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD })
    .expect(200);
  return res.body.data.token as string;
}

/** A real PNG, so `sharp` has something it can actually decode. */
function png(width = 1600, height = 900): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 12, g: 99, b: 88 } },
  })
    .png()
    .toBuffer();
}

describe('poster upload', () => {
  it('lets a coordinator upload for their own mosque', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post('/api/uploads/poster')
      .set('Authorization', `Bearer ${token}`)
      .field('mosqueId', KHADIJA_ID)
      .attach('image', await png(), 'poster.png')
      .expect(201);

    expect(res.body.data.url).toMatch(/^\/uploads\/[a-f0-9-]+\.jpg$/);
    // Downscaled to the cap, and the aspect ratio kept.
    expect(res.body.data.width).toBe(1200);
    expect(res.body.data.height).toBe(675);

    // And it is actually served back, with the CORP header an <img> needs.
    const file = await api.get(res.body.data.url).expect(200);
    expect(file.headers['content-type']).toContain('image');
    expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('refuses a coordinator uploading for a mosque that is not theirs', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post('/api/uploads/poster')
      .set('Authorization', `Bearer ${token}`)
      .field('mosqueId', MADINA_ID)
      .attach('image', await png(), 'poster.png');
    expect(res.status).toBe(403);
  });

  it('refuses an ordinary member outright', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api
      .post('/api/uploads/poster')
      .set('Authorization', `Bearer ${token}`)
      .field('mosqueId', KHADIJA_ID)
      .attach('image', await png(), 'poster.png');
    expect(res.status).toBe(403);
  });

  it('lets a super admin upload for a mosque they hold no membership at', async () => {
    // This is the seam. A super admin publishing on a mosque's behalf holds no
    // `Membership` anywhere, so the plain mosque guard would refuse them on
    // every mosque there is — and the poster field in the console would be
    // permanently broken.
    const token = await superAdminToken();
    await api
      .post('/api/uploads/poster')
      .set('Authorization', `Bearer ${token}`)
      .field('mosqueId', MADINA_ID)
      .attach('image', await png(), 'poster.png')
      .expect(201);
  });
});

describe('platform image upload', () => {
  it('takes an image with no mosque attached', async () => {
    const token = await superAdminToken();
    const res = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await png(800, 800), 'logo.png')
      .expect(201);

    expect(res.body.data.url).toMatch(/^\/uploads\/[a-f0-9-]+\.jpg$/);
    // Under the cap, so it is left at its own size rather than upscaled.
    expect(res.body.data.width).toBe(800);
  });

  it('refuses a mosque coordinator', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await png(), 'logo.png');
    expect(res.status).toBe(403);
  });

  it('rejects a file that is not an image, whatever the mimetype claims', async () => {
    const token = await superAdminToken();
    const res = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      // The client writes this header and can lie about it; `sharp` is what
      // actually decides whether the bytes are an image.
      .attach('image', Buffer.from('this is not a picture'), {
        filename: 'x.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(400);
  });
});

describe('image paths in the console', () => {
  it('only accepts a path this server minted', async () => {
    const token = await superAdminToken();

    const bad = await api
      .post('/api/admin/advertisers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Somebody Else',
        category: 'Retail',
        // Rendered by every client that shows the record, so a free-form URL
        // would let one operator point every reader at a host they own.
        logoUrl: 'https://evil.example.com/tracker.jpg',
      });
    expect(bad.status).toBe(400);

    const uploaded = await api
      .post('/api/uploads/image')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', await png(400, 400), 'logo.png')
      .expect(201);

    await api
      .post('/api/admin/advertisers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Legit Partner', category: 'Retail', logoUrl: uploaded.body.data.url })
      .expect(201);
  });

  it('carries a poster through to a post published on a mosque behalf', async () => {
    const token = await superAdminToken();

    const uploaded = await api
      .post('/api/uploads/poster')
      .set('Authorization', `Bearer ${token}`)
      .field('mosqueId', KHADIJA_ID)
      .attach('image', await png(), 'poster.png')
      .expect(201);

    const post = await api
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mosqueId: KHADIJA_ID,
        type: 'event',
        title: 'Community iftar',
        description: 'Everyone welcome.',
        category: 'Community',
        location: 'Main hall',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 90_000_000).toISOString(),
        imageUrl: uploaded.body.data.url,
        notify: false,
      })
      .expect(201);

    expect(post.body.data.imageUrl).toBe(uploaded.body.data.url);
  });
});

describe('the activity log', () => {
  it('is populated by the seed, so a fresh database does not look broken', async () => {
    const token = await superAdminToken();
    const res = await api
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.total).toBeGreaterThan(10);
    // Newest first, and every row says who and what in plain words.
    const first = res.body.data.items[0];
    expect(first.actorName).toBeTruthy();
    expect(first.summary).toBeTruthy();
  });

  it('records a real action the moment it happens', async () => {
    const token = await superAdminToken();
    const before = await AuditEntryModel.countDocuments();

    await api
      .post('/api/admin/advertisers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Logged Partner', category: 'Services' })
      .expect(201);

    expect(await AuditEntryModel.countDocuments()).toBe(before + 1);
  });
});
