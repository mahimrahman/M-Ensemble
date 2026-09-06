import { describe, expect, it } from 'vitest';
import { SignupModel } from '../src/models/Signup.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * Check-in has two doors: a member scanning the coordinator's QR checks
 * *themselves* in, and a coordinator can check anyone in from the coverage
 * screen. Nobody else, ever.
 */
describe('check-in', () => {
  async function claim(email: string): Promise<string> {
    const token = await tokenFor(email);
    await api.post('/api/posts/post_001/signup').set('Authorization', `Bearer ${token}`);
    return token;
  }

  it('lets a member check themselves in (the QR flow)', async () => {
    const token = await claim(YUSUF);
    await api
      .post('/api/posts/post_001/checkin')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: 'user_001' })
      .expect(200);

    const signup = await SignupModel.findOne({ postId: 'post_001', userId: 'user_001' });
    expect(signup?.checkedInAt).toBeInstanceOf(Date);
  });

  it('lets a coordinator check someone else in', async () => {
    await claim(YUSUF);
    await api
      .post('/api/posts/post_001/checkin')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .send({ userId: 'user_001' })
      .expect(200);
  });

  it('refuses one member checking another in', async () => {
    await claim(YUSUF);
    const other = await tokenFor('bilal@example.com');

    const res = await api
      .post('/api/posts/post_001/checkin')
      .set('Authorization', `Bearer ${other}`)
      .send({ userId: 'user_001' })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('404s when there is no confirmed signup to check in', async () => {
    const res = await api
      .post('/api/posts/post_001/checkin')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .send({ userId: 'user_001' })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('is idempotent — a second scan does not move the time', async () => {
    const token = await claim(YUSUF);
    const auth = `Bearer ${token}`;

    await api
      .post('/api/posts/post_001/checkin')
      .set('Authorization', auth)
      .send({ userId: 'user_001' })
      .expect(200);
    const first = (await SignupModel.findOne({ postId: 'post_001', userId: 'user_001' }))
      ?.checkedInAt;

    await api
      .post('/api/posts/post_001/checkin')
      .set('Authorization', auth)
      .send({ userId: 'user_001' })
      .expect(200);
    const second = (await SignupModel.findOne({ postId: 'post_001', userId: 'user_001' }))
      ?.checkedInAt;

    expect(second?.getTime()).toBe(first?.getTime());
  });
});
