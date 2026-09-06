import { describe, expect, it } from 'vitest';
import { PostModel } from '../src/models/Post.js';
import { SignupModel } from '../src/models/Signup.js';
import { api, tokenFor } from './helpers/api.js';

/**
 * The demo's riskiest moment: two phones tap the last slot at the same instant.
 * Exactly one of them gets in, and `slotsFilled` lands on `slotsNeeded` — never
 * past it.
 */
describe('the slot race', () => {
  it('lets exactly one of ten concurrent claims through', async () => {
    // post_001 needs 4 and seeds at 1, with user_006 already confirmed.
    await PostModel.updateOne({ _id: 'post_001' }, { $set: { slotsFilled: 3 } });

    // Ten people, none of them user_006 (khadija.s@), who is already confirmed
    // on this post: they would get ALREADY_SIGNED_UP rather than FULL, and the
    // test would pass for the wrong reason.
    const emails = [
      'yusuf@example.com',
      'amina@example.com',
      'bilal@example.com',
      'fatima@example.com',
      'omar@example.com',
      'ibrahim@example.com',
      'sumaya@example.com',
      'mustafa@example.com',
      'layla@example.com',
      'hamza@example.com',
    ];
    const tokens = await Promise.all(emails.map(tokenFor));

    const results = await Promise.all(
      tokens.map((token) =>
        api.post('/api/posts/post_001/signup').set('Authorization', `Bearer ${token}`),
      ),
    );

    const created = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409);

    expect(created).toHaveLength(1);
    expect(full).toHaveLength(9);
    expect(full.every((r) => r.body.error.code === 'FULL')).toBe(true);

    const post = await PostModel.findById('post_001');
    expect(post?.slotsFilled).toBe(4);

    // One winner, one new row — the counter and the rows agree.
    const confirmed = await SignupModel.countDocuments({
      postId: 'post_001',
      status: 'confirmed',
    });
    expect(confirmed).toBe(2); // user_006 from the fixtures, plus the winner
  });

  it('has no limit on an announcement', async () => {
    const announcement = await PostModel.findOne({ type: 'announcement' });
    expect(announcement?.slotsNeeded).toBeUndefined();
    expect(announcement?.capacity).toBeUndefined();

    await api
      .post(`/api/posts/${announcement?._id}/signup`)
      .set('Authorization', `Bearer ${await tokenFor('yusuf@example.com')}`)
      .expect(201);
  });
});
