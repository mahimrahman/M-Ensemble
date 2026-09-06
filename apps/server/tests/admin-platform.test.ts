import { describe, expect, it } from 'vitest';
import { api, tokenFor, AMINA, YUSUF } from './helpers/api.js';
import { UserModel } from '../src/models/User.js';
import { InvoiceModel } from '../src/models/Invoice.js';
import { CampaignModel } from '../src/models/Campaign.js';
import { AuditEntryModel } from '../src/models/AuditEntry.js';
import { KHADIJA_ID } from '../src/shared.js';
import { env } from '../src/config/env.js';

/**
 * The platform tier.
 *
 * The first block is the one that matters most: **a mosque coordinator is not a
 * platform administrator.** Amina holds `Membership.role === 'admin'` at
 * Khadija and must still be refused by every route under `/api/admin`. That is
 * the whole reason the two tiers are separate fields, and a regression there
 * would hand every coordinator the money screens.
 */

const SUPER_ADMIN = env.SUPERADMIN_EMAIL;

/** The seed creates this account with the configured password. */
async function superAdminToken(): Promise<string> {
  const res = await api
    .post('/api/auth/login')
    .send({ email: SUPER_ADMIN, password: env.SUPERADMIN_PASSWORD })
    .expect(200);
  return res.body.data.token as string;
}

describe('platform access control', () => {
  it('refuses an ordinary member', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api.get('/api/admin/overview').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a mosque coordinator — a mosque admin is not a platform admin', async () => {
    const token = await tokenFor(AMINA);

    // She really is an admin at her own mosque…
    await api
      .get(`/api/mosques/${KHADIJA_ID}/dashboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // …and that buys her nothing here.
    for (const path of ['/api/admin/overview', '/api/admin/users', '/api/admin/billing/invoices']) {
      const res = await api.get(path).set('Authorization', `Bearer ${token}`);
      expect(res.status, path).toBe(403);
    }
  });

  it('refuses an unauthenticated caller with 401, not 403', async () => {
    const res = await api.get('/api/admin/overview');
    expect(res.status).toBe(401);
  });

  it('lets the super admin in', async () => {
    const token = await superAdminToken();
    const res = await api.get('/api/admin/me').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.body.data.platformRole).toBe('superadmin');
  });

  it('lets support read but not write', async () => {
    await UserModel.updateOne({ email: YUSUF }, { $set: { platformRole: 'support' } });
    const token = await tokenFor(YUSUF);

    await api.get('/api/admin/overview').set('Authorization', `Bearer ${token}`).expect(200);
    await api
      .get('/api/admin/billing/invoices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Reading the money is allowed; moving it is not.
    const res = await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Musallah',
        address: '1 Rue Test, Montréal',
        coordinates: { lat: 45.5, lng: -73.5 },
      });
    expect(res.status).toBe(403);
  });

  it('answers the support inbox for a support account', async () => {
    await UserModel.updateOne({ email: YUSUF }, { $set: { platformRole: 'support' } });
    const token = await tokenFor(YUSUF);

    const list = await api
      .get('/api/admin/support/tickets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ticket = list.body.data.items[0];
    expect(ticket).toBeDefined();

    // Replying is deliberately not superadmin-gated — see admin.routes.ts.
    await api
      .post(`/api/admin/support/tickets/${ticket._id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Looking into this now.' })
      .expect(201);
  });
});

describe('suspension', () => {
  it('blocks sign-in and invalidates a token already issued', async () => {
    const admin = await superAdminToken();
    const victimToken = await tokenFor(YUSUF);
    const victim = await UserModel.findOne({ email: YUSUF });

    // The token works right up to the moment it doesn't.
    await api.get('/api/me').set('Authorization', `Bearer ${victimToken}`).expect(200);

    await api
      .put(`/api/admin/users/${victim!._id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ status: 'suspended' })
      .expect(200);

    // A token issued before the suspension must stop working immediately —
    // otherwise suspension does nothing until the token expires.
    const after = await api.get('/api/me').set('Authorization', `Bearer ${victimToken}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('ACCOUNT_SUSPENDED');

    const login = await api.post('/api/auth/login').send({ email: YUSUF, password: 'mensemble' });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('refuses to suspend yourself', async () => {
    const token = await superAdminToken();
    const me = await api.get('/api/admin/me').set('Authorization', `Bearer ${token}`);

    const res = await api
      .put(`/api/admin/users/${me.body.data.userId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'suspended' });
    expect(res.status).toBe(400);
  });

  it('refuses to remove the last super admin', async () => {
    const token = await superAdminToken();
    const me = await api.get('/api/admin/me').set('Authorization', `Bearer ${token}`);

    const res = await api
      .put(`/api/admin/users/${me.body.data.userId}/platform-role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ platformRole: 'none' });
    expect(res.status).toBe(400);
  });
});

describe('mosque provisioning', () => {
  it('creates a mosque, a coordinator, a membership and a subscription in one call', async () => {
    const token = await superAdminToken();

    const res = await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Masjid An-Nour',
        address: '4000 Rue Jean-Talon, Montréal',
        coordinates: { lat: 45.5401, lng: -73.6203 },
        priceCents: 4900,
        coordinator: { name: 'Idris Karim', email: 'idris@annour.test' },
      })
      .expect(201);

    const { mosque, credential } = res.body.data;
    expect(mosque.joinCode).toMatch(/^[A-Z0-9]{6}$/);
    expect(credential.email).toBe('idris@annour.test');
    expect(credential.password).toHaveLength(14);

    // The credential actually works — which is the only thing that matters
    // about it, and the one thing a shape assertion would not prove.
    const login = await api
      .post('/api/auth/login')
      .send({ email: credential.email, password: credential.password })
      .expect(200);

    // …and it carries the coordinator role at the new mosque.
    const memberships = await api
      .get('/api/me/memberships')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(200);
    expect(memberships.body.data).toContainEqual(
      expect.objectContaining({ mosqueId: mosque._id, role: 'admin' }),
    );

    // The subscription came with it, so the billing screens never branch on null.
    const detail = await api
      .get(`/api/admin/mosques/${mosque._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.subscription.priceCents).toBe(4900);
    expect(detail.body.data.summary.operated).toBe(true);
  });

  it('starts a mosque at zero when no price was agreed', async () => {
    const token = await superAdminToken();
    const res = await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Masjid As-Salam',
        address: '77 Rue Sherbrooke, Montréal',
        coordinates: { lat: 45.51, lng: -73.57 },
      })
      .expect(201);

    // A billing row exists — the console never branches on null — but it bills
    // nothing. A mosque onboarded a minute ago has agreed to nothing, and a
    // console that quietly starts charging on creation is one nobody can trust.
    const detail = await api
      .get(`/api/admin/mosques/${res.body.data.mosque._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.subscription.priceCents).toBe(0);
  });

  it('never stores or logs the issued password', async () => {
    const token = await superAdminToken();
    const res = await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Masjid Al-Huda',
        address: '10 Rue Ontario, Montréal',
        coordinates: { lat: 45.52, lng: -73.55 },
        coordinator: { name: 'Huda Idris', email: 'huda@alhuda.test' },
      })
      .expect(201);

    const password = res.body.data.credential.password;

    const stored = await UserModel.findOne({ email: 'huda@alhuda.test' });
    expect(stored!.passwordHash).not.toContain(password);
    expect(stored!.mustChangePassword).toBe(true);

    const audit = await AuditEntryModel.find({ targetId: res.body.data.mosque._id });
    expect(audit.length).toBeGreaterThan(0);
    expect(JSON.stringify(audit)).not.toContain(password);
  });

  it('gives an existing account the role without resetting its password', async () => {
    const token = await superAdminToken();

    const created = await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Masjid Al-Fajr',
        address: '55 Rue Saint-Denis, Montréal',
        coordinates: { lat: 45.51, lng: -73.56 },
      })
      .expect(201);

    // Yusuf already has an account and has been using it.
    const yusuf = await UserModel.findOne({ email: YUSUF });
    const hashBefore = yusuf!.passwordHash;

    await api
      .post(`/api/admin/mosques/${created.body.data.mosque._id}/credentials`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Yusuf', email: YUSUF })
      .expect(201);

    const after = await UserModel.findOne({ email: YUSUF });
    expect(after!.passwordHash).toBe(hashBefore);

    // His old password still signs him in — the whole point.
    await api.post('/api/auth/login').send({ email: YUSUF, password: 'mensemble' }).expect(200);
  });

  it('rejects a duplicate join code rather than 500ing on the index', async () => {
    const token = await superAdminToken();
    const body = {
      name: 'Masjid Duplicate',
      address: '1 Rue Double, Montréal',
      coordinates: { lat: 45.5, lng: -73.6 },
      joinCode: 'DUPE01',
    };
    await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    const second = await api
      .post('/api/admin/mosques')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...body, name: 'Masjid Duplicate Two' });
    expect(second.status).toBe(409);
  });
});

describe('billing', () => {
  it('records a payment, closes the invoice, and lets a correction reopen it', async () => {
    const token = await superAdminToken();

    const created = await api
      .post('/api/admin/billing/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'subscription',
        mosqueId: KHADIJA_ID,
        lines: [{ description: 'Pro — monthly', quantity: 1, unitCents: 12_900 }],
        taxCents: 1932,
        issue: true,
      })
      .expect(201);

    const invoice = created.body.data;
    expect(invoice.totalCents).toBe(14_832);
    expect(invoice.dueCents).toBe(14_832);
    expect(invoice.status).toBe('open');

    const paid = await api
      .post(`/api/admin/billing/invoices/${invoice._id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 14_832, method: 'etransfer', reference: 'ETR-9001' })
      .expect(201);

    expect(paid.body.data.invoice.status).toBe('paid');
    expect(paid.body.data.invoice.dueCents).toBe(0);

    // A correction: the transfer bounced. A negative row, never an edit.
    const corrected = await api
      .post(`/api/admin/billing/invoices/${invoice._id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: -14_832, method: 'etransfer', note: 'Transfer reversed' })
      .expect(201);

    expect(corrected.body.data.invoice.status).toBe('open');
    expect(corrected.body.data.invoice.dueCents).toBe(14_832);
    // Both rows survive — the history is the point.
    expect(corrected.body.data.payments).toHaveLength(2);
    // And the paid date is cleared, or the revenue chart keeps counting it.
    expect(corrected.body.data.invoice.paidAt).toBeUndefined();
  });

  it('refuses an invoice with two payers or none', async () => {
    const token = await superAdminToken();
    const lines = [{ description: 'Something', quantity: 1, unitCents: 100 }];

    const none = await api
      .post('/api/admin/billing/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'other', lines });
    expect(none.status).toBe(400);

    const both = await api
      .post('/api/admin/billing/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'other', lines, mosqueId: KHADIJA_ID, advertiserId: 'adv_tanjia' });
    expect(both.status).toBe(400);
  });

  it('will not void an invoice that has been paid', async () => {
    const token = await superAdminToken();
    const paid = await InvoiceModel.findOne({ status: 'paid' });

    const res = await api
      .post(`/api/admin/billing/invoices/${paid!._id}/void`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Changed my mind' });
    expect(res.status).toBe(400);
  });

  it('mints unique, sequential invoice numbers under concurrency', async () => {
    const token = await superAdminToken();

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        api
          .post('/api/admin/billing/invoices')
          .set('Authorization', `Bearer ${token}`)
          .send({
            kind: 'subscription',
            mosqueId: KHADIJA_ID,
            lines: [{ description: 'Concurrent', quantity: 1, unitCents: 100 }],
          }),
      ),
    );

    const numbers = results.map((r) => r.body.data?.number);
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(new Set(numbers).size).toBe(8);
  });
});

describe('campaigns and ad delivery', () => {
  it('enforces the status machine rather than trusting the client', async () => {
    const token = await superAdminToken();
    const completed = await CampaignModel.findOne({ status: 'completed' });

    // completed is terminal — a stale tab must not resurrect a finished flight.
    const res = await api
      .put(`/api/admin/campaigns/${completed!._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });
    expect(res.status).toBe(400);
  });

  it('serves only active, in-flight, correctly targeted campaigns', async () => {
    const token = await tokenFor(YUSUF);

    const res = await api
      .get('/api/ads/slot?placement=feed&city=montreal&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = res.body.data.map((ad: { campaignId: string }) => ad.campaignId);
    expect(ids).toContain('camp_tanjia_iftar'); // active, Montréal, feed
    expect(ids).not.toContain('camp_atlas_newcomers'); // pending
    expect(ids).not.toContain('camp_sabr_eid'); // completed, and its flight is over

    // Nothing commercial reaches the phone.
    for (const ad of res.body.data) {
      expect(ad).not.toHaveProperty('budgetCents');
      expect(ad).not.toHaveProperty('targeting');
      expect(ad.disclosure).toBeTruthy();
    }
  });

  it('does not serve a campaign to a city it does not target', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api
      .get('/api/ads/slot?placement=feed&city=toronto&limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const ids = res.body.data.map((ad: { campaignId: string }) => ad.campaignId);
    expect(ids).not.toContain('camp_tanjia_iftar');
  });

  it('counts impressions and keeps spend derived from the counters', async () => {
    const token = await tokenFor(YUSUF);
    const before = await CampaignModel.findById('camp_tanjia_iftar');

    await api
      .post('/api/ads/camp_tanjia_iftar/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'impression' })
      .expect(200);

    const after = await CampaignModel.findById('camp_tanjia_iftar');
    expect(after!.impressions).toBe(before!.impressions + 1);
    // CPM spend follows the counter, and never exceeds what was sold.
    expect(after!.spentCents).toBe(
      Math.min(after!.budgetCents, Math.round((after!.impressions / 1000) * after!.rateCents)),
    );
  });

  it('ignores an event for a paused campaign instead of erroring', async () => {
    const token = await tokenFor(YUSUF);
    await CampaignModel.updateOne({ _id: 'camp_tanjia_iftar' }, { $set: { status: 'paused' } });

    // A phone that rendered the card a second before it was paused is not a
    // client error, and there is no screen that could act on a failure.
    await api
      .post('/api/ads/camp_tanjia_iftar/events')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'click' })
      .expect(200);
  });

  it('refuses a creative link that is not http(s)', async () => {
    const token = await superAdminToken();
    const res = await api
      .post('/api/admin/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({
        advertiserId: 'adv_tanjia',
        name: 'Bad link',
        creative: {
          headline: 'Tap here',
          body: 'Something',
          ctaLabel: 'Go',
          // This URL is rendered as a tappable link in every reader's feed.
          ctaUrl: 'javascript:alert(1)',
        },
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86_400_000).toISOString(),
        budgetCents: 1000,
      });
    expect(res.status).toBe(400);
  });
});

describe('publishing on a mosque behalf', () => {
  it('posts as the mosque but records who really did it', async () => {
    const token = await superAdminToken();
    const me = await api.get('/api/admin/me').set('Authorization', `Bearer ${token}`);

    const res = await api
      .post('/api/admin/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        mosqueId: KHADIJA_ID,
        type: 'announcement',
        title: 'Parking closed on Saturday',
        description: 'The lot is resurfaced this weekend.',
        category: 'Community',
        location: 'Masjid Khadija',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        notify: false,
      })
      .expect(201);

    expect(res.body.data.mosqueId).toBe(KHADIJA_ID);
    expect(res.body.data.createdBy).toBe(me.body.data.userId);

    const audit = await AuditEntryModel.findOne({
      action: 'post.created_on_behalf',
      targetId: res.body.data._id,
    });
    expect(audit).not.toBeNull();
    expect(audit!.summary).toContain('Khadija');
  });
});

describe('the overview', () => {
  it('builds every number without a second source of truth', async () => {
    const token = await superAdminToken();
    const res = await api
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const data = res.body.data;
    expect(data.users.value).toBeGreaterThan(0);
    expect(data.mosques.value).toBeGreaterThan(0);
    expect(data.mrrCents).toBeGreaterThan(0);
    // Every day in the window is present, including the quiet ones — a series
    // that skips empty days draws a chart where a dead week looks busy.
    expect(data.daily).toHaveLength(30);
    expect(data.attendanceRate30d).toBeGreaterThanOrEqual(0);
    expect(data.attendanceRate30d).toBeLessThanOrEqual(100);
  });

  it('caps searches and page sizes rather than letting one request load everything', async () => {
    const token = await superAdminToken();
    const res = await api
      .get('/api/admin/users?pageSize=100000')
      .set('Authorization', `Bearer ${token}`);
    // Zod rejects it at the edge rather than the service silently clamping.
    expect(res.status).toBe(400);
  });

  it('survives a regex metacharacter in the search box', async () => {
    const token = await superAdminToken();
    await api.get('/api/admin/users?q=%28').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
