import { describe, expect, it } from 'vitest';
import { LATE_CANCEL_HOURS } from '../src/shared.js';
import { PostModel } from '../src/models/Post.js';
import { SignupModel } from '../src/models/Signup.js';
import { api, tokenFor, AMINA, YUSUF } from './helpers/api.js';

/**
 * Reliability. Two rules, and the fairness of the whole feature rests on them:
 *
 *   cancelling early is free — so people tell us while there is still time to
 *   find a replacement, rather than staying quiet and not turning up
 *
 *   a no-show is dated to when the shift ended, not to when the server noticed
 */
describe('late cancellation', () => {
  /** A volunteer post the given number of hours from now, with room to claim. */
  async function postStartingIn(hours: number): Promise<string> {
    const start = new Date(Date.now() + hours * 3_600_000);
    const end = new Date(start.getTime() + 2 * 3_600_000);
    const created = await api
      .post('/api/posts')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .send({
        mosqueId: 'mosque_khadija',
        type: 'volunteer',
        title: `Shift in ${hours}h`,
        description: 'x',
        category: 'Community meals',
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: 'Main hall',
        slotsNeeded: 4,
      })
      .expect(201);
    return created.body.data._id as string;
  }

  it('leaves no trace when you withdraw in good time', async () => {
    const token = `Bearer ${await tokenFor(YUSUF)}`;
    const postId = await postStartingIn(LATE_CANCEL_HOURS + 12);

    await api.post(`/api/posts/${postId}/signup`).set('Authorization', token).expect(201);
    const res = await api
      .delete(`/api/posts/${postId}/signup`)
      .set('Authorization', token)
      .expect(200);

    expect(res.body.data.lateCancelled).toBe(false);
    const signup = await SignupModel.findOne({ postId, userId: 'user_001' });
    expect(signup?.lateCancelledAt).toBeUndefined();
  });

  it('goes on the record inside the window', async () => {
    const token = `Bearer ${await tokenFor(YUSUF)}`;
    const postId = await postStartingIn(LATE_CANCEL_HOURS - 2);

    await api.post(`/api/posts/${postId}/signup`).set('Authorization', token).expect(201);
    const res = await api
      .delete(`/api/posts/${postId}/signup`)
      .set('Authorization', token)
      .expect(200);

    expect(res.body.data.lateCancelled).toBe(true);
    const signup = await SignupModel.findOne({ postId, userId: 'user_001' });
    expect(signup?.lateCancelledAt).toBeInstanceOf(Date);

    // And it reaches both audiences: the volunteer's own record...
    const mine = await api.get('/api/me/reliability').set('Authorization', token).expect(200);
    expect(mine.body.data.lateCancellations).toBe(1);
    expect(mine.body.data.recent[0]).toMatchObject({ kind: 'late-cancel', postId });

    // ...and the coordinator's view of that member.
    const detail = await api
      .get('/api/mosques/mosque_khadija/members/user_001')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);
    expect(detail.body.data.member.lateCancellations).toBe(1);
    expect(detail.body.data.incidents.some((i: { kind: string }) => i.kind === 'late-cancel')).toBe(
      true,
    );
  });
});

describe('no-shows', () => {
  it('are dated to when the post ended, not when the sweep ran', async () => {
    // The regression this test exists for: stamping `$$NOW` dated every
    // historical no-show to today, so one sweep after a seed dropped a year of
    // them into the last-30-days window and the dashboard read wrong.
    const old = await PostModel.findOne({
      mosqueId: 'mosque_khadija',
      cancelledAt: { $exists: false },
      endAt: { $lt: new Date(Date.now() - 30 * 86_400_000) },
    });
    expect(old).toBeTruthy();

    // Touching the dashboard runs the sweep.
    await api
      .get('/api/mosques/mosque_khadija/dashboard')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);

    const stamped = await SignupModel.find({ postId: old!._id, noShowAt: { $exists: true } });
    for (const signup of stamped) {
      expect(signup.noShowAt?.getTime()).toBe(old!.endAt.getTime());
    }
  });

  it('never counts a post someone was checked in for', async () => {
    await api
      .get('/api/mosques/mosque_khadija/dashboard')
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);

    const wrong = await SignupModel.countDocuments({
      checkedInAt: { $exists: true },
      noShowAt: { $exists: true },
    });
    expect(wrong).toBe(0);
  });

  it('is idempotent — a second sweep moves nothing', async () => {
    const token = `Bearer ${await tokenFor(AMINA)}`;
    await api.get('/api/mosques/mosque_khadija/dashboard').set('Authorization', token).expect(200);
    const first = await SignupModel.find({ noShowAt: { $exists: true } }).sort({ _id: 1 });

    await api.get('/api/mosques/mosque_khadija/dashboard').set('Authorization', token).expect(200);
    const second = await SignupModel.find({ noShowAt: { $exists: true } }).sort({ _id: 1 });

    expect(second.map((s) => [s._id, s.noShowAt?.getTime()])).toEqual(
      first.map((s) => [s._id, s.noShowAt?.getTime()]),
    );
  });
});

describe('the mosque profile', () => {
  const M = 'mosque_khadija';

  it('lets its coordinator edit the descriptive fields', async () => {
    const res = await api
      .patch(`/api/mosques/${M}`)
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .send({ bio: 'A new description.', services: ['One', '  ', 'Two'] })
      .expect(200);

    expect(res.body.data.bio).toBe('A new description.');
    // Blank lines from the textarea are dropped rather than stored.
    expect(res.body.data.services).toEqual(['One', 'Two']);
  });

  it('refuses a plain member', async () => {
    const res = await api
      .patch(`/api/mosques/${M}`)
      .set('Authorization', `Bearer ${await tokenFor(YUSUF)}`)
      .send({ bio: 'hijacked' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an attempt to change identity', async () => {
    const token = `Bearer ${await tokenFor(AMINA)}`;
    // Name, address, coordinates and joinCode are identity: a mosque must not
    // be able to rename itself into another one.
    await api.patch(`/api/mosques/${M}`).set('Authorization', token).send({ name: 'X' }).expect(400);
    await api
      .patch(`/api/mosques/${M}`)
      .set('Authorization', token)
      .send({ joinCode: 'STOLEN' })
      .expect(400);
  });
});
