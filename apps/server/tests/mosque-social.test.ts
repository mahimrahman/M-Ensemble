import { describe, expect, it } from 'vitest';
import { normalizeSocial, socialLinks } from '../src/shared.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * The mosque's pages elsewhere.
 *
 * Two things worth pinning: coordinators type handles and paste URLs
 * interchangeably and must land on the same stored link, and clearing a field
 * has to actually remove the link — a merge would make one permanent.
 */

const PATH = '/api/mosques/mosque_khadija';

/** Every platform, so the body matches what the editor really posts. */
function socialBody(overrides: Record<string, string>) {
  return {
    facebook: '',
    instagram: '',
    youtube: '',
    tiktok: '',
    x: '',
    whatsapp: '',
    telegram: '',
    ...overrides,
  };
}

describe('normalizeSocial', () => {
  it('lands a handle, a bare URL and a full URL on the same link', () => {
    for (const raw of [
      'ciicmac',
      '@ciicmac',
      'instagram.com/ciicmac',
      'https://instagram.com/ciicmac/',
    ]) {
      expect(normalizeSocial('instagram', raw)).toBe('https://instagram.com/ciicmac');
    }
  });

  it('puts the @ back for the platforms whose URLs carry one', () => {
    expect(normalizeSocial('youtube', 'yourmosque')).toBe('https://youtube.com/@yourmosque');
    expect(normalizeSocial('tiktok', '@yourmosque')).toBe('https://tiktok.com/@yourmosque');
  });

  it('upgrades a remembered http link rather than storing it', () => {
    expect(normalizeSocial('facebook', 'http://facebook.com/AicpCanada')).toBe(
      'https://facebook.com/AicpCanada',
    );
  });

  it('sends a WhatsApp number to wa.me and an invite code to the group', () => {
    expect(normalizeSocial('whatsapp', '+1 514-000-0000')).toBe('https://wa.me/15140000000');
    expect(normalizeSocial('whatsapp', 'https://chat.whatsapp.com/AbCd1234')).toBe(
      'https://chat.whatsapp.com/AbCd1234',
    );
  });

  it('treats blank and whitespace as nothing at all', () => {
    expect(normalizeSocial('x', '')).toBeNull();
    expect(normalizeSocial('x', '   ')).toBeNull();
    expect(normalizeSocial('x', '@')).toBeNull();
  });
});

describe('socialLinks', () => {
  it('is empty for a mosque that has listed none', () => {
    expect(socialLinks(undefined)).toEqual([]);
    expect(socialLinks({})).toEqual([]);
  });

  it('keeps the declared platform order, not the object key order', () => {
    const links = socialLinks({ telegram: 'https://t.me/a', facebook: 'https://facebook.com/b' });
    expect(links.map((l) => l.platform)).toEqual(['facebook', 'telegram']);
  });
});

describe('GET /mosques/:id social', () => {
  it('keeps a mosque’s own handles and fills the rest with placeholders', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api
      .get('/api/mosques/mosque_verdun')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.social).toEqual({
      facebook: 'https://facebook.com/CentreIslamiqueVerdun',
      instagram: 'https://instagram.com/maccivmac',
      x: 'https://x.com',
    });
  });

  /**
   * The profile hides the whole row on an empty list, so a mosque we hold no
   * handles for would render without one. The seed's placeholders are what
   * stop that — this is the assertion that every detail page has the row.
   */
  it('gives a mosque with no verified handles the placeholder trio', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api
      .get('/api/mosques/mosque_fatima')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(socialLinks(res.body.data.social).map((l) => l.platform)).toEqual([
      'facebook',
      'instagram',
      'x',
    ]);
  });

  it('leaves no seeded mosque without a row to show', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api.get('/api/mosques').set('Authorization', `Bearer ${token}`).expect(200);

    const bare = res.body.data.filter(
      (m: { social?: object }) => socialLinks(m.social).length === 0,
    );
    expect(bare).toEqual([]);
  });
});

describe('PATCH /mosques/:id social', () => {
  it('stores the URL for a handle the coordinator typed', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .patch(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({
        social: socialBody({
          instagram: '@khadijah_centre',
          facebook: 'facebook.com/khadijahmosquemontreal',
        }),
      })
      .expect(200);

    expect(res.body.data.social).toEqual({
      facebook: 'https://facebook.com/khadijahmosquemontreal',
      instagram: 'https://instagram.com/khadijah_centre',
    });
  });

  it('removes a link when its field comes back empty', async () => {
    const token = await tokenFor(AMINA);
    await api
      .patch(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ social: socialBody({ instagram: '@khadijah_centre', x: '@khadijah' }) })
      .expect(200);

    const res = await api
      .patch(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ social: socialBody({ instagram: '@khadijah_centre' }) })
      .expect(200);

    expect(res.body.data.social).toEqual({ instagram: 'https://instagram.com/khadijah_centre' });
  });

  it('drops the whole object once every field is empty', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .patch(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ social: socialBody({}) })
      .expect(200);

    expect(res.body.data.social).toBeUndefined();
  });

  it('rejects a platform the app cannot draw', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .patch(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ social: { myspace: 'khadijah' } })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('is still a coordinator-only edit', async () => {
    const token = await tokenFor(YUSUF);
    await api
      .patch(PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({ social: socialBody({ instagram: '@not-mine' }) })
      .expect(403);
  });
});
