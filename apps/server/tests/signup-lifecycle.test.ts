import { describe, expect, it } from 'vitest';
import { PostModel } from '../src/models/Post.js';
import { SignupModel } from '../src/models/Signup.js';
import { YUSUF, api, tokenFor } from './helpers/api.js';

describe('signup lifecycle', () => {
  it('withdraw then re-signup reuses the row and clears the check-in', async () => {
    const auth = `Bearer ${await tokenFor(YUSUF)}`;
    const before = await PostModel.findById('post_001');

    const first = await api
      .post('/api/posts/post_001/signup')
      .set('Authorization', auth)
      .expect(201);

    // Pretend they turned up, so we can prove the flag is cleared.
    await SignupModel.updateOne(
      { _id: first.body.data._id },
      { $set: { checkedInAt: new Date() } },
    );

    await api.delete('/api/posts/post_001/signup').set('Authorization', auth).expect(200);

    const withdrawn = await api
      .get('/api/posts/post_001/signups')
      .set('Authorization', auth)
      .expect(200);
    const mine = withdrawn.body.data.find((s: { userId: string }) => s.userId === 'user_001');
    expect(mine.status).toBe('withdrawn');
    // Absent, not null — the contract marks it optional.
    expect('checkedInAt' in mine).toBe(false);
    expect((await PostModel.findById('post_001'))?.slotsFilled).toBe(before?.slotsFilled);

    const second = await api
      .post('/api/posts/post_001/signup')
      .set('Authorization', auth)
      .expect(201);

    expect(second.body.data._id).toBe(first.body.data._id);
    expect(second.body.data.status).toBe('confirmed');
    expect('checkedInAt' in second.body.data).toBe(false);
    expect(new Date(second.body.data.createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(first.body.data.createdAt).getTime(),
    );

    expect(await SignupModel.countDocuments({ postId: 'post_001', userId: 'user_001' })).toBe(1);
  });

  it('404s a withdrawal with nothing to withdraw from', async () => {
    const res = await api
      .delete('/api/posts/post_002/signup')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('never lets slotsFilled go negative', async () => {
    const auth = `Bearer ${await tokenFor(YUSUF)}`;
    await PostModel.updateOne({ _id: 'post_001' }, { $set: { slotsFilled: 0 } });

    await api.post('/api/posts/post_001/signup').set('Authorization', auth).expect(201);
    await PostModel.updateOne({ _id: 'post_001' }, { $set: { slotsFilled: 0 } });
    await api.delete('/api/posts/post_001/signup').set('Authorization', auth).expect(200);

    expect((await PostModel.findById('post_001'))?.slotsFilled).toBe(0);
  });

  it('returns every status from /signups — the app filters, not the server', async () => {
    const auth = `Bearer ${await tokenFor(YUSUF)}`;
    await api.post('/api/posts/post_001/signup').set('Authorization', auth);
    await api.delete('/api/posts/post_001/signup').set('Authorization', auth);

    const res = await api
      .get('/api/posts/post_001/signups')
      .set('Authorization', auth)
      .expect(200);

    const statuses = res.body.data.map((s: { status: string }) => s.status);
    expect(statuses).toContain('withdrawn');
    expect(statuses).toContain('confirmed');
  });
});
