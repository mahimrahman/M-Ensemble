import { describe, expect, it } from 'vitest';
import { CURRENT_USER_ID, KHADIJA_ID, mockPosts } from '../src/shared.js';
import { SignupModel } from '../src/models/index.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * `post_now` is the fixture that exists so the check-in flow can be walked
 * through on any day, not only the day its shift happens to fall on. Every
 * other post hangs off a wall time; this one is measured from the seed.
 *
 * The property worth pinning is exactly that: seed, and a shift is in progress
 * with the demo account on it and not yet checked in. If someone ever gives it
 * a fixed date, these fail rather than the demo.
 */
describe('the always-live shift', () => {
  const POST = 'post_now';

  it('is in progress at the moment it is seeded', () => {
    const post = mockPosts.find((p) => p._id === POST);
    expect(post, 'post_now is missing from the fixtures').toBeDefined();

    const now = Date.now();
    expect(new Date(post!.startAt).getTime()).toBeLessThan(now);
    expect(new Date(post!.endAt).getTime()).toBeGreaterThan(now);
    // Long enough to survive a rehearsal, a break and the demo itself.
    expect(new Date(post!.endAt).getTime() - now).toBeGreaterThan(2 * 60 * 60 * 1000);
  });

  it('reaches the feed of someone who follows the mosque', async () => {
    const res = await api
      .get('/api/feed')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(200);

    const ids = (res.body.data as { _id: string }[]).map((p) => p._id);
    expect(ids).toContain(POST);
  });

  it('leaves the demo account signed up and waiting to be checked in', async () => {
    const signup = await SignupModel.findOne({ postId: POST, userId: CURRENT_USER_ID });
    expect(signup?.status).toBe('confirmed');
    expect(signup?.checkedInAt).toBeUndefined();
  });

  it('checks that account in, and stays put on a second scan', async () => {
    const token = `Bearer ${await tokenFor(YUSUF)}`;

    await api
      .post(`/api/posts/${POST}/checkin`)
      .set('Authorization', token)
      .send({ userId: CURRENT_USER_ID })
      .expect(200);

    const first = await SignupModel.findOne({ postId: POST, userId: CURRENT_USER_ID });
    expect(first?.checkedInAt).toBeInstanceOf(Date);

    // Scanning the same code twice must not move the arrival time.
    await api
      .post(`/api/posts/${POST}/checkin`)
      .set('Authorization', token)
      .send({ userId: CURRENT_USER_ID })
      .expect(200);

    const second = await SignupModel.findOne({ postId: POST, userId: CURRENT_USER_ID });
    expect(second?.checkedInAt?.getTime()).toBe(first?.checkedInAt?.getTime());
  });

  it('gives the coordinator a roster with someone already in and others not', async () => {
    const res = await api
      .get(`/api/mosques/${KHADIJA_ID}/roster?upcoming=true&post=${POST}`)
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);

    const entries = res.body.data as { signup: { checkedInAt?: string } }[];
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.some((e) => e.signup.checkedInAt)).toBe(true);
    expect(entries.some((e) => !e.signup.checkedInAt)).toBe(true);
  });
});
