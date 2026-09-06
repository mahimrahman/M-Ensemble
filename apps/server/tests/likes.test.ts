import { describe, expect, it } from 'vitest';
import { likeCountFor, mockLikes } from '../src/shared.js';
import { LikeModel } from '../src/models/index.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * Likes are the one public counter in the app, so the thing worth testing is
 * not that the endpoint answers — it is that the number on the card and the
 * rows behind it can never disagree, however many times a heart is tapped.
 */
describe('likes', () => {
  const POST = 'post_002';

  async function auth(email: string) {
    return `Bearer ${await tokenFor(email)}`;
  }

  it('seeds the count from the fixture rows', async () => {
    const res = await api
      .get(`/api/posts/${POST}`)
      .set('Authorization', await auth(YUSUF))
      .expect(200);

    expect(res.body.data.likeCount).toBe(likeCountFor(POST));
    expect(await LikeModel.countDocuments({ postId: POST })).toBe(likeCountFor(POST));
  });

  it('likes once however many times it is tapped', async () => {
    const token = await auth(YUSUF);
    const before = likeCountFor(POST);
    const seeded = mockLikes.some((l) => l.postId === POST && l.userId === 'user_001');

    const first = await api.post(`/api/posts/${POST}/like`).set('Authorization', token).expect(200);
    const second = await api
      .post(`/api/posts/${POST}/like`)
      .set('Authorization', token)
      .expect(200);

    // Yusuf may or may not be one of the seeded likers for this post, so the
    // count only moves if he wasn't. What both taps must agree on is the total.
    const expected = seeded ? before : before + 1;
    expect(first.body.data).toMatchObject({ postId: POST, liked: true, likeCount: expected });
    expect(second.body.data.likeCount).toBe(expected);
    expect(await LikeModel.countDocuments({ postId: POST, userId: 'user_001' })).toBe(1);
  });

  it('unliking is idempotent and never goes below zero', async () => {
    const token = await auth(YUSUF);
    await api.post(`/api/posts/${POST}/like`).set('Authorization', token).expect(200);

    const first = await api
      .delete(`/api/posts/${POST}/like`)
      .set('Authorization', token)
      .expect(200);
    const second = await api
      .delete(`/api/posts/${POST}/like`)
      .set('Authorization', token)
      .expect(200);

    expect(first.body.data.liked).toBe(false);
    expect(second.body.data.likeCount).toBe(first.body.data.likeCount);
    expect(first.body.data.likeCount).toBeGreaterThanOrEqual(0);
    expect(await LikeModel.countDocuments({ postId: POST, userId: 'user_001' })).toBe(0);
  });

  it('keeps the cached count equal to the rows behind it', async () => {
    // Two different people, in both directions, then compare the number the
    // API reports against a straight count of the collection.
    await api
      .post(`/api/posts/${POST}/like`)
      .set('Authorization', await auth(YUSUF))
      .expect(200);
    await api
      .post(`/api/posts/${POST}/like`)
      .set('Authorization', await auth(AMINA))
      .expect(200);
    await api
      .delete(`/api/posts/${POST}/like`)
      .set('Authorization', await auth(YUSUF))
      .expect(200);

    const res = await api
      .get(`/api/posts/${POST}`)
      .set('Authorization', await auth(YUSUF))
      .expect(200);

    expect(res.body.data.likeCount).toBe(await LikeModel.countDocuments({ postId: POST }));
  });

  it('corrects a count that has drifted away from the rows', async () => {
    const token = await auth(YUSUF);
    // Nothing in the app can do this; a bad migration or a half-applied write
    // can. The next tap has to put it right rather than build on the lie.
    await api.post(`/api/posts/${POST}/like`).set('Authorization', token).expect(200);
    await LikeModel.deleteMany({ postId: POST });

    const res = await api.post(`/api/posts/${POST}/like`).set('Authorization', token).expect(200);

    expect(res.body.data.likeCount).toBe(1);
    expect(await LikeModel.countDocuments({ postId: POST })).toBe(1);
  });

  it('lists the ids the signed-in user has liked, and nobody else', async () => {
    const token = await auth(YUSUF);
    await api.post(`/api/posts/${POST}/like`).set('Authorization', token).expect(200);
    await api
      .post(`/api/posts/post_004/like`)
      .set('Authorization', await auth(AMINA))
      .expect(200);

    const res = await api.get('/api/me/likes').set('Authorization', token).expect(200);

    const ids = res.body.data as string[];
    expect(ids).toContain(POST);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining(mockLikes.filter((l) => l.userId === 'user_001').map((l) => l.postId)),
    );
    // Amina's like on another post is hers, not his.
    const hers = await api
      .get('/api/me/likes')
      .set('Authorization', await auth(AMINA))
      .expect(200);
    expect(hers.body.data).toContain('post_004');
    expect(ids).not.toContain('post_004');
  });

  it('404s on a post that does not exist, and 401s without a token', async () => {
    await api
      .post('/api/posts/post_nope/like')
      .set('Authorization', await auth(YUSUF))
      .expect(404);
    await api.post(`/api/posts/${POST}/like`).expect(401);
  });
});
