import { describe, expect, it } from 'vitest';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * Input the app never sends but a client could. Found by a smoke run against
 * the live server: both used to be accepted with a 2xx.
 */

const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

function volunteerPost(overrides: Record<string, unknown> = {}) {
  return {
    mosqueId: 'mosque_khadija',
    type: 'volunteer',
    title: 'Validation shift',
    description: 'Server-side checks',
    category: 'Volunteering',
    startAt: hoursFromNow(26),
    endAt: hoursFromNow(28),
    location: 'Main hall',
    slotsNeeded: 2,
    ...overrides,
  };
}

describe('post time validation', () => {
  it('rejects a post that ends before it starts', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(volunteerPost({ startAt: hoursFromNow(28), endAt: hoursFromNow(26) }))
      .expect(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a post that ends exactly when it starts', async () => {
    const token = await tokenFor(AMINA);
    const at = hoursFromNow(26);
    await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(volunteerPost({ startAt: at, endAt: at }))
      .expect(400);
  });

  it('still accepts a well-ordered post', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(volunteerPost())
      .expect(201);
    expect(res.body.data.slotsFilled).toBe(0);
  });

  it('rejects a patch that moves endAt before the stored startAt', async () => {
    const token = await tokenFor(AMINA);
    const created = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${token}`)
      .send(volunteerPost())
      .expect(201);
    const id = created.body.data._id as string;

    await api
      .patch(`/api/posts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ endAt: hoursFromNow(25) })
      .expect(400);

    await api
      .patch(`/api/posts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: hoursFromNow(27), endAt: hoursFromNow(26.5) })
      .expect(400);

    // Moving both ends together, in order, is fine.
    const moved = await api
      .patch(`/api/posts/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startAt: hoursFromNow(30), endAt: hoursFromNow(31) })
      .expect(200);
    expect(new Date(moved.body.data.endAt).getTime()).toBeGreaterThan(
      new Date(moved.body.data.startAt).getTime(),
    );
  });
});

describe('push token validation', () => {
  it('accepts an Expo push token', async () => {
    const token = await tokenFor(YUSUF);
    await api
      .post('/api/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
      .expect(200);
  });

  it('rejects anything Expo could not deliver to', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api
      .post('/api/me/push-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ token: 'garbage' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
