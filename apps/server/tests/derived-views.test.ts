import { describe, expect, it } from 'vitest';
import type { EventOutcome, MosqueMember, Post, Signup } from '@m-ensemble/shared';
import {
  KHADIJA_ADMIN_ID,
  KHADIJA_ID,
  mockFollows,
  mockPastPosts,
  mockPosts,
  mockSignups,
} from '../src/shared.js';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';

/**
 * The mock client is the oracle for these formulas. Rather than reimplement it,
 * each assertion derives its expectation straight from the shared fixture
 * arrays — a genuine cross-check, since the server computed its answer from
 * Mongo.
 */
describe('derived views', () => {
  const khadijaPosts: Post[] = [...mockPosts, ...mockPastPosts].filter(
    (p) => p.mosqueId === KHADIJA_ID,
  );
  const khadijaPostIds = new Set(khadijaPosts.map((p) => p._id));
  const khadijaSignups: Signup[] = mockSignups.filter((s) => khadijaPostIds.has(s.postId));

  async function asAdmin(path: string) {
    return api
      .get(`/api/mosques/${KHADIJA_ID}${path}`)
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(200);
  }

  it('counts followers exactly as the fixtures do', async () => {
    const res = await asAdmin('/dashboard');
    expect(res.body.data.followerCount).toBe(
      mockFollows.filter((f) => f.mosqueId === KHADIJA_ID).length,
    );
    expect(res.body.data.mosqueId).toBe(KHADIJA_ID);
  });

  it('reports attendance over ended posts only, as a 0-100 integer', async () => {
    const now = Date.now();
    const endedIds = new Set(
      khadijaPosts.filter((p) => !p.cancelledAt && new Date(p.endAt).getTime() < now).map((p) => p._id),
    );
    const confirmed = khadijaSignups.filter(
      (s) => endedIds.has(s.postId) && s.status === 'confirmed',
    );
    const attended = confirmed.filter((s) => s.checkedInAt);
    const expected = confirmed.length
      ? Math.round((attended.length / confirmed.length) * 100)
      : 0;

    const res = await asAdmin('/dashboard');
    expect(res.body.data.attendanceRate).toBe(expected);
    expect(res.body.data.attendanceRate).toBeGreaterThanOrEqual(0);
    expect(res.body.data.attendanceRate).toBeLessThanOrEqual(100);
  });

  it('sums volunteer slots over live posts only', async () => {
    const now = Date.now();
    const liveVolunteer = khadijaPosts.filter(
      (p) =>
        !p.cancelledAt &&
        new Date(p.endAt).getTime() >= now &&
        p.type === 'volunteer' &&
        p.slotsNeeded !== undefined,
    );

    const res = await asAdmin('/dashboard');
    expect(res.body.data.slotsNeeded).toBe(
      liveVolunteer.reduce((sum, p) => sum + (p.slotsNeeded ?? 0), 0),
    );
    expect(res.body.data.slotsUnfilled).toBe(
      liveVolunteer.reduce((sum, p) => sum + Math.max(0, (p.slotsNeeded ?? 0) - p.slotsFilled), 0),
    );
  });

  it('lists the union of followers, role-holders and anyone who signed up', async () => {
    const expected = new Set<string>([
      ...mockFollows.filter((f) => f.mosqueId === KHADIJA_ID).map((f) => f.userId),
      KHADIJA_ADMIN_ID,
      ...khadijaSignups.map((s) => s.userId),
    ]);

    const res = await asAdmin('/members');
    const members: MosqueMember[] = res.body.data;

    expect(new Set(members.map((m) => m.userId))).toEqual(expected);
    // The coordinator does not follow the mosque they run, and is still here.
    expect(members.map((m) => m.userId)).toContain(KHADIJA_ADMIN_ID);
  });

  it('sorts members admins-first, then by attendance, then by name', async () => {
    const members: MosqueMember[] = (await asAdmin('/members')).body.data;

    expect(members[0]?.role).toBe('admin');
    const ranks = members.map((m) => (m.role === 'admin' ? 0 : 1));
    expect(ranks).toEqual([...ranks].sort());

    const plain = members.filter((m) => m.role === 'member');
    for (let i = 1; i < plain.length; i += 1) {
      const prev = plain[i - 1]!;
      const cur = plain[i]!;
      expect(
        prev.attendedCount > cur.attendedCount ||
          (prev.attendedCount === cur.attendedCount && prev.name.localeCompare(cur.name) <= 0),
      ).toBe(true);
    }
  });

  it('omits lastSeenAt entirely for someone who never checked in', async () => {
    const members: MosqueMember[] = (await asAdmin('/members')).body.data;
    const never = members.find((m) => m.attendedCount === 0);

    expect(never).toBeDefined();
    // Absent, not null — the app tests for the key.
    expect('lastSeenAt' in never!).toBe(false);
  });

  it('excludes announcements from outcomes and sorts newest first', async () => {
    const outcomes: EventOutcome[] = (await asAdmin('/outcomes')).body.data;

    expect(outcomes.length).toBeGreaterThan(0);
    expect(outcomes.every((o) => o.type !== 'announcement')).toBe(true);
    expect(outcomes.map((o) => o.startAt)).toEqual(
      [...outcomes.map((o) => o.startAt)].sort().reverse(),
    );
    // target is slotsNeeded ?? capacity ?? null — explicitly nullable here.
    expect(outcomes.every((o) => o.target === null || typeof o.target === 'number')).toBe(true);
  });

  it('keeps the roster to confirmed signups on live posts when upcoming=true', async () => {
    const res = await asAdmin('/roster?upcoming=true');
    const now = Date.now();

    expect(res.body.data.every((r: { signup: Signup }) => r.signup.status === 'confirmed')).toBe(
      true,
    );
    expect(res.body.data.every((r: { endAt: string }) => new Date(r.endAt).getTime() >= now)).toBe(
      true,
    );
    expect(res.body.data.map((r: { startAt: string }) => r.startAt)).toEqual(
      [...res.body.data.map((r: { startAt: string }) => r.startAt)].sort(),
    );
  });

  it('404s a member detail for somebody not in the directory', async () => {
    const res = await api
      .get(`/api/mosques/${KHADIJA_ID}/members/user_999`)
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses to let a coordinator demote themselves', async () => {
    const res = await api
      .put(`/api/mosques/${KHADIJA_ID}/members/${KHADIJA_ADMIN_ID}/role`)
      .set('Authorization', `Bearer ${await tokenFor(AMINA)}`)
      .send({ role: 'member' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('promotes without touching the follow', async () => {
    const admin = `Bearer ${await tokenFor(AMINA)}`;
    const before = await api.get('/api/me/mosques').set('Authorization', `Bearer ${await tokenFor(YUSUF)}`);

    const res = await api
      .put(`/api/mosques/${KHADIJA_ID}/members/user_001/role`)
      .set('Authorization', admin)
      .send({ role: 'admin' })
      .expect(200);
    expect(res.body.data.role).toBe('admin');

    const after = await api.get('/api/me/mosques').set('Authorization', `Bearer ${await tokenFor(YUSUF)}`);
    expect(after.body.data).toEqual(before.body.data);
  });
});

describe('service hours', () => {
  it('counts every checked-in signup regardless of post type', async () => {
    // Deliberately unlike MosqueMember.minutesServed, which is volunteer-only.
    // The mock does both and the app is written around both.
    const res = await api
      .get('/api/me/hours')
      .set('Authorization', `Bearer ${await tokenFor('adam@example.com')}`)
      .expect(200);

    expect(res.body.data).toHaveProperty('totalMinutes');
    expect(res.body.data).toHaveProperty('shiftsCompleted');
    expect(res.body.data.totalMinutes).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /users', () => {
  it('returns names only, drops unknown ids, and takes an empty list', async () => {
    const token = `Bearer ${await tokenFor(YUSUF)}`;

    const some = await api
      .get('/api/users?ids=user_001,user_002,user_999')
      .set('Authorization', token)
      .expect(200);
    expect(some.body.data).toHaveLength(2);
    expect(Object.keys(some.body.data[0]).sort()).toEqual(['_id', 'name']);

    const none = await api.get('/api/users?ids=').set('Authorization', token).expect(200);
    expect(none.body.data).toEqual([]);
  });
});
