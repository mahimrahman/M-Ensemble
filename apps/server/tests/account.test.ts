import { beforeEach, describe, expect, it } from 'vitest';
import { AMINA, YUSUF, api, tokenFor } from './helpers/api.js';
import { sentEmails } from '../src/services/email.service.js';
import { MembershipModel } from '../src/models/Membership.js';
import { PostModel } from '../src/models/Post.js';
import { SignupModel } from '../src/models/Signup.js';
import { UserModel } from '../src/models/User.js';
import { TEST_RATE_LIMIT_HEADER } from '../src/middleware/rateLimit.js';

const bearer = (token: string) => `Bearer ${token}`;

/** The token inside the last email sent to `to`, read off its `?token=` query. */
function lastTokenFor(to: string): string {
  const mail = [...sentEmails].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`no email sent to ${to}`);
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error(`no token in email to ${to}:\n${mail.text}`);
  return match[1]!;
}

async function signUp(email: string, password = 'correct-horse-battery') {
  const res = await api.post('/api/auth/signup').send({ email, password, name: 'Test' }).expect(201);
  return res.body.data as { token: string; user: { _id: string; emailVerified: boolean } };
}

describe('account lifecycle', () => {
  beforeEach(() => {
    sentEmails.length = 0;
  });

  describe('password reset', () => {
    it('forgot → reset → old password fails, new one works, old token is dead', async () => {
      const before = await tokenFor(YUSUF);

      await api.post('/api/auth/forgot-password').send({ email: YUSUF }).expect(200);
      const token = lastTokenFor(YUSUF);

      await api
        .post('/api/auth/reset-password')
        .send({ token, password: 'a-brand-new-password' })
        .expect(200);

      await api.post('/api/auth/login').send({ email: YUSUF, password: 'mensemble' }).expect(401);
      await api
        .post('/api/auth/login')
        .send({ email: YUSUF, password: 'a-brand-new-password' })
        .expect(200);

      // Every session from before the reset is signed out.
      await api.get('/api/me').set('Authorization', bearer(before)).expect(401);

      // The link is single-use.
      const reused = await api
        .post('/api/auth/reset-password')
        .send({ token, password: 'yet-another-password' })
        .expect(400);
      expect(reused.body.error.code).toBe('INVALID_TOKEN');
    });

    it('answers 200 for an unknown email and sends nothing', async () => {
      await api.post('/api/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200);
      expect(sentEmails).toHaveLength(0);
    });

    it('a second request invalidates the first link', async () => {
      await api.post('/api/auth/forgot-password').send({ email: YUSUF }).expect(200);
      const first = lastTokenFor(YUSUF);
      await api.post('/api/auth/forgot-password').send({ email: YUSUF }).expect(200);

      await api
        .post('/api/auth/reset-password')
        .send({ token: first, password: 'a-brand-new-password' })
        .expect(400);
    });

    it('holds the new password to the policy', async () => {
      await api.post('/api/auth/forgot-password').send({ email: YUSUF }).expect(200);
      const res = await api
        .post('/api/auth/reset-password')
        .send({ token: lastTokenFor(YUSUF), password: 'short' })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('change-password', () => {
    it('keeps this session (via the returned token) and revokes the others', async () => {
      const phone = await tokenFor(YUSUF);
      const tablet = await tokenFor(YUSUF);

      const res = await api
        .post('/api/auth/change-password')
        .set('Authorization', bearer(phone))
        .send({ currentPassword: 'mensemble', newPassword: 'a-brand-new-password' })
        .expect(200);

      await api.get('/api/me').set('Authorization', bearer(tablet)).expect(401);
      await api.get('/api/me').set('Authorization', bearer(phone)).expect(401);
      await api.get('/api/me').set('Authorization', bearer(res.body.data.token)).expect(200);
    });

    it('refuses a wrong current password with 400, not a sign-out 401', async () => {
      const res = await api
        .post('/api/auth/change-password')
        .set('Authorization', bearer(await tokenFor(YUSUF)))
        .send({ currentPassword: 'nope-nope', newPassword: 'a-brand-new-password' })
        .expect(400);
      expect(res.body.error.code).toBe('BAD_CREDENTIALS');
    });
  });

  describe('logout', () => {
    it('revokes just this token', async () => {
      const a = await tokenFor(YUSUF);
      const b = await tokenFor(YUSUF);

      await api.post('/api/auth/logout').set('Authorization', bearer(a)).expect(200);

      await api.get('/api/me').set('Authorization', bearer(a)).expect(401);
      await api.get('/api/me').set('Authorization', bearer(b)).expect(200);
    });
  });

  describe('email verification', () => {
    it('sends a link on signup; following it flips emailVerified', async () => {
      const email = 'fresh@example.com';
      const { token, user } = await signUp(email);
      expect(user.emailVerified).toBe(false);

      // The send is fire-and-forget after the 201.
      await new Promise((r) => setTimeout(r, 50));
      const verifyToken = lastTokenFor(email);

      const res = await api.post('/api/auth/verify-email').send({ token: verifyToken }).expect(200);
      expect(res.body.data.emailVerified).toBe(true);

      const me = await api.get('/api/me').set('Authorization', bearer(token)).expect(200);
      expect(me.body.data.emailVerified).toBe(true);
    });

    it('serves the browser landing page for the emailed link', async () => {
      const email = 'browser@example.com';
      await signUp(email);
      await new Promise((r) => setTimeout(r, 50));

      const page = await api.get(`/api/verify-email?token=${lastTokenFor(email)}`).expect(200);
      expect(page.type).toBe('text/html');
      expect(page.text).toContain('Email confirmed');
      expect(page.text).toContain('mensemble://');

      const again = await api.get(`/api/verify-email?token=${lastTokenFor(email)}`).expect(400);
      expect(again.text).toContain('expired');
    });

    it('resend requires auth and is a no-op once verified', async () => {
      await api.post('/api/auth/resend-verification').expect(401);

      const email = 'resend@example.com';
      const { token } = await signUp(email);
      await new Promise((r) => setTimeout(r, 50));
      sentEmails.length = 0;

      await api.post('/api/auth/resend-verification').set('Authorization', bearer(token)).expect(200);
      expect(sentEmails.filter((m) => m.to === email)).toHaveLength(1);

      await api.post('/api/auth/verify-email').send({ token: lastTokenFor(email) }).expect(200);
      sentEmails.length = 0;
      await api.post('/api/auth/resend-verification').set('Authorization', bearer(token)).expect(200);
      expect(sentEmails).toHaveLength(0);
    });

    it('renders the reset-password form page', async () => {
      const page = await api.get('/api/reset-password?token=abc').expect(200);
      expect(page.type).toBe('text/html');
      expect(page.text).toContain('/api/auth/reset-password');
      expect(page.headers['content-security-policy']).toMatch(/nonce-/);
    });
  });

  describe('account deletion and export', () => {
    it('exports everything held about the caller', async () => {
      const res = await api
        .get('/api/me/export')
        .set('Authorization', bearer(await tokenFor(YUSUF)))
        .expect(200);

      const data = res.body.data;
      expect(Object.keys(data).sort()).toEqual([
        'donations',
        'exportedAt',
        'follows',
        'likes',
        'memberships',
        'notificationPrefs',
        'notifications',
        'signups',
        'user',
      ]);
      expect(data.user).toMatchObject({ email: YUSUF, emailVerified: false });
      expect(data.follows.length).toBeGreaterThan(0);
      expect(data.signups.length).toBeGreaterThan(0);
    });

    it('needs the password, anonymises the row, frees upcoming slots and kills the token', async () => {
      const token = await tokenFor(YUSUF);
      const me = await api.get('/api/me').set('Authorization', bearer(token)).expect(200);
      const userId = me.body.data._id as string;

      const wrong = await api
        .delete('/api/me')
        .set('Authorization', bearer(token))
        .send({ password: 'not-it' })
        .expect(400);
      expect(wrong.body.error.code).toBe('BAD_CREDENTIALS');

      // What Yusuf holds before: confirmed signups on posts that have not ended.
      const confirmed = await SignupModel.find({ userId, status: 'confirmed' });
      const upcoming = await PostModel.find({
        _id: { $in: confirmed.map((s) => s.postId) },
        endAt: { $gte: new Date() },
      });
      expect(upcoming.length).toBeGreaterThan(0);
      const filledBefore = new Map(upcoming.map((p) => [p._id, p.slotsFilled]));

      await api
        .delete('/api/me')
        .set('Authorization', bearer(token))
        .send({ password: 'mensemble' })
        .expect(200);

      await api.get('/api/me').set('Authorization', bearer(token)).expect(401);
      await api.post('/api/auth/login').send({ email: YUSUF, password: 'mensemble' }).expect(401);

      const row = await UserModel.findById(userId);
      expect(row).toMatchObject({
        name: 'Deleted user',
        email: `deleted+${userId}@deleted.invalid`,
        interests: [],
        status: 'suspended',
      });
      expect(row?.deletedAt).toBeInstanceOf(Date);

      for (const post of upcoming) {
        const after = await PostModel.findById(post._id);
        expect(after?.slotsFilled).toBe(filledBefore.get(post._id)! - 1);
      }
      expect(
        await SignupModel.countDocuments({
          userId,
          status: 'confirmed',
          postId: { $in: upcoming.map((p) => p._id) },
        }),
      ).toBe(0);
      // History is kept, detached from a name: past rows stay as they were.
      expect(await SignupModel.countDocuments({ userId })).toBe(confirmed.length);
      expect(await SignupModel.countDocuments({ userId, status: 'confirmed' })).toBe(
        confirmed.length - upcoming.length,
      );
    });

    it('refuses the last coordinator of a mosque with LAST_COORDINATOR', async () => {
      const token = await tokenFor(AMINA);
      const res = await api
        .delete('/api/me')
        .set('Authorization', bearer(token))
        .send({ password: '123456' })
        .expect(409);
      expect(res.body.error.code).toBe('LAST_COORDINATOR');

      // Hand over: a second admin at Khadija lets the deletion through.
      const yusuf = await UserModel.findOne({ email: YUSUF });
      await MembershipModel.updateOne(
        { userId: yusuf!._id, mosqueId: 'mosque_khadija' },
        { $set: { role: 'admin' } },
        { upsert: true },
      );
      await MembershipModel.updateOne(
        { userId: yusuf!._id, mosqueId: 'mosque_khadija' },
        { $setOnInsert: { _id: 'm_handover', createdAt: new Date() } },
        { upsert: true },
      );
      await api
        .delete('/api/me')
        .set('Authorization', bearer(token))
        .send({ password: '123456' })
        .expect(200);
      expect(await MembershipModel.countDocuments({ mosqueId: 'mosque_khadija', role: 'admin' })).toBe(1);
    });
  });

  describe('rate limiting', () => {
    it('answers 429 RATE_LIMITED once the per-email budget is spent', async () => {
      const { env } = await import('../src/config/env.js');
      let last: { status: number; body: { error?: { code: string } } } | undefined;
      for (let i = 0; i <= env.RATE_LIMIT_AUTH_MAX; i++) {
        last = await api
          .post('/api/auth/login')
          .set(TEST_RATE_LIMIT_HEADER, '1')
          .send({ email: 'limited@example.com', password: 'whatever' });
        if (last.status === 429) break;
      }
      expect(last?.status).toBe(429);
      expect(last?.body.error?.code).toBe('RATE_LIMITED');
    });

    it('is off for ordinary tests', async () => {
      for (let i = 0; i < 3; i++) {
        await api.post('/api/auth/login').send({ email: YUSUF, password: 'wrong' }).expect(401);
      }
    });
  });

  describe('legal documents', () => {
    it.each(['en', 'fr'] as const)('serves privacy and terms as JSON in %s', async (lang) => {
      for (const kind of ['privacy', 'terms'] as const) {
        const res = await api.get(`/api/legal/${kind}?lang=${lang}`).expect(200);
        expect(res.body.data).toMatchObject({ kind, lang, version: '1.0', effectiveAt: '2026-11-01' });
        expect(res.body.data.title.length).toBeGreaterThan(3);
        expect(res.body.data.body).toContain('## ');
        expect(res.body.data.body).not.toContain('{{SUPPORT_EMAIL}}');
      }
    });

    it('serves HTML to a browser', async () => {
      const res = await api.get('/api/legal/privacy?lang=fr').set('Accept', 'text/html').expect(200);
      expect(res.type).toBe('text/html');
      expect(res.text).toContain('<h2>');
      expect(res.text).toContain('Politique de confidentialité');
    });

    it('404s an unknown document', async () => {
      await api.get('/api/legal/cookies').expect(404);
    });
  });

  describe('health', () => {
    it('is 200 with the database connected, on both paths', async () => {
      const a = await api.get('/api/health').expect(200);
      expect(a.body.data.db).toBe('connected');
      await api.get('/api/health/ready').expect(200);
    });
  });
});
