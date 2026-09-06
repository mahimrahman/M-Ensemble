import { describe, expect, it } from 'vitest';
import { CURRENT_USER_ID, KHADIJA_ID, MADINA_ID, mockFollows } from '../src/shared.js';
import { FollowModel } from '../src/models/Follow.js';
import { NotificationModel } from '../src/models/Notification.js';
import { PostModel } from '../src/models/Post.js';
import { UserModel } from '../src/models/User.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * Followers of Khadija other than the coordinator sending — the audience every
 * broadcast assertion below is measured against. Read from the fixtures rather
 * than spelled out, so adding a follower widens the expectation instead of
 * turning the suite red.
 */
async function khadijaAudience(senderId: string): Promise<string[]> {
  const follows = mockFollows.filter((f) => f.mosqueId === KHADIJA_ID && f.userId !== senderId);
  const users = await UserModel.find({
    _id: { $in: follows.map((f) => f.userId) },
    'notificationPrefs.announcements': true,
  });
  return users.map((u) => u._id);
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('the inbox', () => {
  it('starts empty and reports nothing unread', async () => {
    const res = await api
      .get('/api/me/notifications')
      .set(auth(await tokenFor(YUSUF)))
      .expect(200);

    expect(res.body.data).toEqual({ items: [], unread: 0 });
  });

  it('marks everything read, and does nothing the second time', async () => {
    const token = await tokenFor(YUSUF);

    await NotificationModel.create({
      _id: 'notif_test_1',
      userId: CURRENT_USER_ID,
      mosqueId: KHADIJA_ID,
      kind: 'mosque',
      title: 'Test',
      body: 'Body',
      createdAt: new Date(),
    });

    const before = await api.get('/api/me/notifications').set(auth(token)).expect(200);
    expect(before.body.data.unread).toBe(1);

    const read = await api.post('/api/me/notifications/read').set(auth(token)).expect(200);
    expect(read.body.data.unread).toBe(0);
    expect(read.body.data.items[0].readAt).toBeTruthy();

    // Idempotent: re-reading must not move the timestamp it already wrote.
    const firstReadAt = read.body.data.items[0].readAt;
    const again = await api.post('/api/me/notifications/read').set(auth(token)).expect(200);
    expect(again.body.data.items[0].readAt).toBe(firstReadAt);
  });

  it('never shows one user another user’s notifications', async () => {
    await NotificationModel.create({
      _id: 'notif_test_2',
      userId: CURRENT_USER_ID,
      mosqueId: KHADIJA_ID,
      kind: 'mosque',
      title: 'For Yusuf only',
      body: 'Body',
      createdAt: new Date(),
    });

    const res = await api
      .get('/api/me/notifications')
      .set(auth(await tokenFor(AMINA)))
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });
});

describe('broadcasting to followers', () => {
  const message = { title: 'Closed Saturday', body: 'Plumbing work closes the hall.' };

  it('writes one row per follower and leaves the sender out', async () => {
    const admin = await UserModel.findOne({ email: AMINA });
    const expected = await khadijaAudience(admin!._id);

    const res = await api
      .post(`/api/mosques/${KHADIJA_ID}/notifications`)
      .set(auth(await tokenFor(AMINA)))
      .send(message)
      .expect(201);

    expect(res.body.data.recipients).toBe(expected.length);
    // Nothing reaches Expo under NODE_ENV=test, and the count says so rather
    // than claiming phones buzzed.
    expect(res.body.data.pushed).toBe(0);

    const rows = await NotificationModel.find({ mosqueId: KHADIJA_ID, kind: 'mosque' });
    expect(rows).toHaveLength(expected.length);
    expect(rows.every((r) => r.userId !== admin!._id)).toBe(true);
    expect(rows.every((r) => r.title === message.title && r.body === message.body)).toBe(true);
    // A written message points at no post — there is nothing to open.
    expect(rows.every((r) => r.postId === undefined)).toBe(true);
  });

  it('lands in a follower’s own inbox, unread', async () => {
    await api
      .post(`/api/mosques/${KHADIJA_ID}/notifications`)
      .set(auth(await tokenFor(AMINA)))
      .send(message)
      .expect(201);

    const res = await api
      .get('/api/me/notifications')
      .set(auth(await tokenFor(YUSUF)))
      .expect(200);

    expect(res.body.data.unread).toBe(1);
    expect(res.body.data.items[0]).toMatchObject({
      mosqueId: KHADIJA_ID,
      kind: 'mosque',
      title: message.title,
    });
  });

  it('skips followers who turned announcements off', async () => {
    await UserModel.updateOne(
      { _id: CURRENT_USER_ID },
      { $set: { 'notificationPrefs.announcements': false } },
    );

    await api
      .post(`/api/mosques/${KHADIJA_ID}/notifications`)
      .set(auth(await tokenFor(AMINA)))
      .send(message)
      .expect(201);

    const mine = await NotificationModel.find({ userId: CURRENT_USER_ID });
    expect(mine).toHaveLength(0);
  });

  it('refuses a coordinator of another mosque', async () => {
    await api
      .post(`/api/mosques/${MADINA_ID}/notifications`)
      .set(auth(await tokenFor(AMINA)))
      .send(message)
      .expect(403);

    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it('refuses a plain member of the mosque itself', async () => {
    await api
      .post(`/api/mosques/${KHADIJA_ID}/notifications`)
      .set(auth(await tokenFor(YUSUF)))
      .send(message)
      .expect(403);

    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it('rejects an empty message rather than sending one', async () => {
    await api
      .post(`/api/mosques/${KHADIJA_ID}/notifications`)
      .set(auth(await tokenFor(AMINA)))
      .send({ title: '   ', body: 'Body' })
      .expect(400);

    expect(await NotificationModel.countDocuments()).toBe(0);
  });
});

describe('the post fan-out', () => {
  /**
   * The fan-out runs after the 201 has gone out, so a test that asserts on it
   * immediately races the response. Poll instead of sleeping a fixed amount:
   * fast when it lands fast, and it fails as a missing row rather than a flake.
   */
  async function waitForRows(postId: string, timeoutMs = 2000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const count = await NotificationModel.countDocuments({ postId });
      if (count > 0 || Date.now() > deadline) return count;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('reaches followers whose interests match, whether or not they have a push token', async () => {
    // Yusuf follows Khadija. Give him the category and take away his token —
    // the case that used to be silently dropped, since a missing token meant
    // no notification of any kind.
    await UserModel.updateOne(
      { _id: CURRENT_USER_ID },
      { $set: { interests: ['Food service'] }, $unset: { pushToken: '' } },
    );

    const res = await api
      .post('/api/posts')
      .set(auth(await tokenFor(AMINA)))
      .send({
        mosqueId: KHADIJA_ID,
        type: 'volunteer',
        title: 'Iftar setup',
        description: 'Tables and trays from 5pm.',
        category: 'Food service',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 90_000_000).toISOString(),
        location: 'Main hall',
        slotsNeeded: 4,
      })
      .expect(201);

    const postId = res.body.data._id as string;
    expect(await waitForRows(postId)).toBeGreaterThan(0);

    const mine = await NotificationModel.findOne({ userId: CURRENT_USER_ID, postId });
    expect(mine).toBeTruthy();
    expect(mine!.kind).toBe('post');
    expect(mine!.title).toBe('Iftar setup');
    expect(mine!.readAt).toBeUndefined();

    // The post it points at is the one that was just created, so the tap has
    // somewhere real to go.
    expect(await PostModel.findById(postId)).toBeTruthy();
  });

  it('leaves out followers whose interests do not match', async () => {
    await UserModel.updateOne({ _id: CURRENT_USER_ID }, { $set: { interests: ['Teaching'] } });
    await FollowModel.deleteMany({ mosqueId: KHADIJA_ID, userId: { $ne: CURRENT_USER_ID } });

    const res = await api
      .post('/api/posts')
      .set(auth(await tokenFor(AMINA)))
      .send({
        mosqueId: KHADIJA_ID,
        type: 'volunteer',
        title: 'Kitchen shift',
        description: 'Washing up.',
        category: 'Food service',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 90_000_000).toISOString(),
        location: 'Kitchen',
        slotsNeeded: 2,
      })
      .expect(201);

    // Give the fan-out the same window the passing case gets, so this asserts
    // "nobody was notified" rather than "the test got there first".
    expect(await waitForRows(res.body.data._id as string, 500)).toBe(0);
  });
});
