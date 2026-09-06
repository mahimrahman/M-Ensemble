import { describe, expect, it } from 'vitest';
import { PostModel } from '../src/models/Post.js';
import { SignupModel } from '../src/models/Signup.js';
import { UserModel } from '../src/models/User.js';
import { api, tokenFor } from './helpers/api.js';

/**
 * The demo's riskiest moment: two phones tap the last slot at the same instant.
 * Exactly one of them gets in, and `slotsFilled` lands on `slotsNeeded` — never
 * past it.
 */
describe('the slot race', () => {
  it('lets exactly one of ten concurrent claims through', async () => {
    // The demo shift: `slotsNeeded: 4`. Found by shape rather than by id, so
    // renumbering the fixtures cannot silently point this at a 60-seat class
    // with no limit — which would let all ten claims through.
    const target = await PostModel.findOne({ type: 'volunteer', slotsNeeded: 4 }).sort({ _id: 1 });
    expect(target).toBeTruthy();
    const postId = target!._id;
    const limit = target!.slotsNeeded!;

    // One slot left, so exactly one of the ten can win.
    await PostModel.updateOne({ _id: postId }, { $set: { slotsFilled: limit - 1 } });

    // Nobody already confirmed on this post: they would get ALREADY_SIGNED_UP
    // rather than FULL, and the test would pass for the wrong reason.
    const claimed = new Set(
      (await SignupModel.find({ postId, status: 'confirmed' })).map((s) => s.userId),
    );

    // Ten seeded people, none of them already confirmed here — an existing row
    // would answer ALREADY_SIGNED_UP rather than FULL and pass for the wrong
    // reason. Picked from the collection so the list survives a fixture edit.
    const contenders = (await UserModel.find({ _id: { $nin: [...claimed] } }).sort({ _id: 1 }))
      .slice(0, 10)
      .map((u) => u.email);
    expect(contenders).toHaveLength(10);

    const tokens = await Promise.all(contenders.map(tokenFor));

    const results = await Promise.all(
      tokens.map((token) =>
        api.post(`/api/posts/${postId}/signup`).set('Authorization', `Bearer ${token}`),
      ),
    );

    const created = results.filter((r) => r.status === 201);
    const full = results.filter((r) => r.status === 409);

    expect(created).toHaveLength(1);
    expect(full).toHaveLength(9);
    expect(full.every((r) => r.body.error.code === 'FULL')).toBe(true);

    // The counter lands on the limit — never past it.
    const post = await PostModel.findById(postId);
    expect(post?.slotsFilled).toBe(limit);

    // One winner, one new row — the counter and the rows agree.
    const confirmed = await SignupModel.countDocuments({ postId, status: 'confirmed' });
    expect(confirmed).toBe(claimed.size + 1);
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
