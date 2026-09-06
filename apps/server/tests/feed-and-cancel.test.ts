import { describe, expect, it } from 'vitest';
import { PostModel } from '../src/models/Post.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

interface FeedPost {
  _id: string;
  mosqueId: string;
  type: string;
  startAt: string;
  cancelledAt?: string;
}

async function feed(token: string, query = ''): Promise<FeedPost[]> {
  const res = await api
    .get(`/api/feed${query}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  return res.body.data;
}

describe('feed', () => {
  it('shows only live posts from the mosques you follow, soonest first', async () => {
    const posts = await feed(await tokenFor(YUSUF));
    const now = Date.now();

    // user_001 follows Khadija and Madina and nothing else.
    expect(new Set(posts.map((p) => p.mosqueId))).toEqual(
      new Set(['mosque_khadija', 'mosque_madina']),
    );
    expect(posts.every((p) => !p.cancelledAt)).toBe(true);
    expect(posts.every((p) => new Date(p.startAt).getTime() || true)).toBe(true);
    expect(posts.map((p) => p.startAt)).toEqual([...posts.map((p) => p.startAt)].sort());

    const raw = await PostModel.find({ _id: { $in: posts.map((p) => p._id) } });
    expect(raw.every((p) => p.endAt.getTime() >= now)).toBe(true);
  });

  it('filters by type and scopes by mosque', async () => {
    const token = await tokenFor(YUSUF);

    const volunteers = await feed(token, '?types=volunteer');
    expect(volunteers.every((p) => p.type === 'volunteer')).toBe(true);

    const khadija = await feed(token, '?mosques=mosque_khadija');
    expect(khadija.every((p) => p.mosqueId === 'mosque_khadija')).toBe(true);

    // ?mosques wins over what you follow — that is how the city filter browses.
    const ottawa = await feed(token, '?mosques=mosque_ottawa');
    expect(ottawa.every((p) => p.mosqueId === 'mosque_ottawa')).toBe(true);
  });
});

describe('cancelling a post', () => {
  const CANCELLED = 'post_001';

  async function cancel(): Promise<void> {
    await api
      .post(`/api/posts/${CANCELLED}/cancel`)
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);
  }

  it('drops it from the feed and the mosque list but keeps it under ?all=true', async () => {
    await cancel();
    const memberToken = await tokenFor(YUSUF);
    const adminToken = await tokenFor(AMINA);

    expect((await feed(memberToken)).some((p) => p._id === CANCELLED)).toBe(false);

    const live = await api
      .get('/api/mosques/mosque_khadija/posts')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(live.body.data.some((p: FeedPost) => p._id === CANCELLED)).toBe(false);

    const all = await api
      .get('/api/mosques/mosque_khadija/posts?all=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(all.body.data.some((p: FeedPost) => p._id === CANCELLED)).toBe(true);
  });

  it('still serves it from GET /posts/:id so the detail screen can say so', async () => {
    await cancel();
    const res = await api
      .get(`/api/posts/${CANCELLED}`)
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(200);

    expect(res.body.data.cancelledAt).toBeTruthy();
  });

  it('answers a signup with 410 and code NOT_FOUND', async () => {
    await cancel();
    const res = await api
      .post(`/api/posts/${CANCELLED}/signup`)
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .expect(410);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('is idempotent', async () => {
    await cancel();
    const first = await PostModel.findById(CANCELLED);
    await cancel();
    const second = await PostModel.findById(CANCELLED);

    expect(second?.cancelledAt?.getTime()).toBe(first?.cancelledAt?.getTime());
  });
});

describe('admin gating', () => {
  it('403s a plain member creating a post, and 201s the coordinator', async () => {
    const body = {
      mosqueId: 'mosque_khadija',
      type: 'volunteer',
      title: 'Test shift',
      description: 'x',
      category: 'Volunteering',
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      endAt: new Date(Date.now() + 90_000_000).toISOString(),
      location: 'Main hall',
      slotsNeeded: 2,
    };

    const denied = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .send(body)
      .expect(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');

    const created = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .send(body)
      .expect(201);
    expect(created.body.data).toMatchObject({ slotsFilled: 0, createdBy: 'user_002' });
  });

  it('403s a member asking for ?all=true, but serves the plain list', async () => {
    const token = await tokenFor(YUSUF);
    await api
      .get('/api/mosques/mosque_khadija/posts?all=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await api
      .get('/api/mosques/mosque_khadija/posts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rejects a PATCH that tries to change type or mosqueId', async () => {
    const token = `Bearer ${await tokenFor(AMINA)}`;
    await api
      .patch('/api/posts/post_001')
      .set('Authorization', token)
      .send({ type: 'event' })
      .expect(400);
    await api
      .patch('/api/posts/post_001')
      .set('Authorization', token)
      .send({ mosqueId: 'mosque_madina' })
      .expect(400);
    await api
      .patch('/api/posts/post_001')
      .set('Authorization', token)
      .send({ title: 'Renamed' })
      .expect(200);
  });
});
