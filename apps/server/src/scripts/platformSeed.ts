/**
 * Seeds the platform tier — the super admin, and enough money, partners and
 * tickets for the console to be worth looking at.
 *
 * **These fixtures live here rather than in `@m-ensemble/shared`.** Everything
 * in that package is shared with the mobile mock client, which is the whole
 * reason the demo walkthrough and the rehearsal show the same data. Nothing in
 * this file has a mock-client counterpart: the app never reads an invoice.
 *
 * Upserts by `_id`, like the rest of the seed, so it is safe to run twice and
 * leaves anything created outside it alone. Dates hang off the moment the
 * module is imported, so a seed is only correct for the day it ran.
 */

import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import {
  AdvertiserModel,
  AuditEntryModel,
  CampaignModel,
  CampaignStatModel,
  CounterModel,
  DonationModel,
  InvoiceModel,
  PaymentModel,
  SignupModel,
  SubscriptionModel,
  SupportTicketModel,
  UserModel,
} from '../models/index.js';
import { FollowModel } from '../models/Follow.js';
import {
  CIIC_ID,
  CURRENT_USER_ID,
  FATIMA_ID,
  KHADIJA_ADMIN_ID,
  KHADIJA_ID,
  MADINA_ID,
  RAWDAH_ID,
  SALAHOUDDINE_ID,
  VERDUN_ID,
  defaultNotificationPrefs,
  platformFeeCents,
} from '../shared.js';
import { env } from '../config/env.js';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

/** `n` days from now, at a fixed wall time so a re-seed is stable within a day. */
const at = (days: number, hour = 12): Date => {
  const d = new Date(now + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const money = (dollars: number): number => Math.round(dollars * 100);

async function upsert<T extends { _id: string }>(model: Model<any>, rows: T[]): Promise<void> {
  if (!rows.length) return;
  await model.bulkWrite(
    rows.map((row) => ({
      replaceOne: { filter: { _id: row._id }, replacement: row, upsert: true },
    })),
  );
}

// ─── The super admin ────────────────────────────────────────────────────────

/**
 * Create the super admin, or promote the account that already holds that email.
 *
 * Promotion rather than replacement matters: on a database where somebody has
 * already signed up with this address, overwriting the row would silently
 * change their password and drop their history. This only ever *adds* the role.
 *
 * The password is only written when the account is being created. Re-seeding
 * must not reset a password the operator has since changed.
 */
async function seedSuperAdmin(rounds: number): Promise<{ email: string; created: boolean }> {
  const email = env.SUPERADMIN_EMAIL.trim().toLowerCase();
  const existing = await UserModel.findOne({ email });

  if (existing) {
    if (existing.platformRole !== 'superadmin') {
      existing.platformRole = 'superadmin';
      await existing.save();
    }
    return { email, created: false };
  }

  await UserModel.create({
    _id: 'user_platform_admin',
    name: env.SUPERADMIN_NAME,
    email,
    passwordHash: await bcrypt.hash(env.SUPERADMIN_PASSWORD, rounds),
    interests: [],
    notificationPrefs: { ...defaultNotificationPrefs },
    platformRole: 'superadmin',
    status: 'active',
    createdAt: at(-365),
  });
  return { email, created: true };
}

/**
 * Give the seeded accounts a plausible signup date.
 *
 * The schema defaults `createdAt` to the moment the row is inserted, which
 * would make every fixture user look like it joined the second the seed ran —
 * and the overview's "users, and what that was 30 days ago" would read as a
 * platform that gained its entire membership this morning. The earliest thing
 * a person did is the closest honest answer we have to when they arrived.
 */
async function backdateUsers(): Promise<void> {
  const [follows, signups] = await Promise.all([
    FollowModel.aggregate<{ _id: string; first: Date }>([
      { $group: { _id: '$userId', first: { $min: '$createdAt' } } },
    ]),
    SignupModel.aggregate<{ _id: string; first: Date }>([
      { $group: { _id: '$userId', first: { $min: '$createdAt' } } },
    ]),
  ]);

  const earliest = new Map<string, number>();
  for (const row of [...follows, ...signups]) {
    if (!(row.first instanceof Date)) continue;
    const seen = earliest.get(row._id);
    if (seen === undefined || row.first.getTime() < seen)
      earliest.set(row._id, row.first.getTime());
  }

  await UserModel.bulkWrite(
    [...earliest].map(([userId, ms]) => ({
      updateOne: {
        filter: { _id: userId },
        // A week before their first visible act. Nobody follows a mosque the
        // instant they install an app.
        update: { $set: { createdAt: new Date(ms - 7 * DAY) } },
      },
    })),
  );
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

interface PlanRow {
  mosqueId: string;
  plan: 'free' | 'standard' | 'pro';
  status: 'active' | 'trialing' | 'past_due' | 'cancelled';
  priceCents: number;
  note?: string;
  startedDaysAgo: number;
}

/** A believable spread: two paying well, one comped, one in trial, one late. */
const PLAN_ROWS: PlanRow[] = [
  {
    mosqueId: KHADIJA_ID,
    plan: 'pro',
    status: 'active',
    priceCents: money(129),
    startedDaysAgo: 280,
  },
  {
    mosqueId: MADINA_ID,
    plan: 'standard',
    status: 'active',
    priceCents: money(49),
    startedDaysAgo: 210,
  },
  {
    mosqueId: SALAHOUDDINE_ID,
    plan: 'standard',
    status: 'past_due',
    priceCents: money(49),
    note: 'Invoice chased twice — treasurer changed in March.',
    startedDaysAgo: 150,
  },
  {
    mosqueId: CIIC_ID,
    plan: 'standard',
    status: 'trialing',
    priceCents: money(49),
    note: '60-day trial, sponsor-funded.',
    startedDaysAgo: 20,
  },
  {
    mosqueId: VERDUN_ID,
    plan: 'free',
    status: 'active',
    priceCents: 0,
    note: 'Small musallah — free tier indefinitely.',
    startedDaysAgo: 95,
  },
  {
    mosqueId: FATIMA_ID,
    plan: 'pro',
    status: 'active',
    priceCents: money(129),
    startedDaysAgo: 60,
  },
  {
    mosqueId: RAWDAH_ID,
    plan: 'free',
    status: 'active',
    priceCents: 0,
    note: 'Pre-approved, coordinator has not signed up yet.',
    startedDaysAgo: 5,
  },
];

async function seedSubscriptions(): Promise<void> {
  await upsert(
    SubscriptionModel,
    PLAN_ROWS.map((row) => {
      const startedAt = at(-row.startedDaysAgo);
      const periodStart = at(-(row.startedDaysAgo % 30 || 30));
      const periodEnd = new Date(periodStart.getTime() + 30 * DAY);
      return {
        _id: `sub_${row.mosqueId}`,
        mosqueId: row.mosqueId,
        plan: row.plan,
        status: row.status,
        interval: 'monthly' as const,
        priceCents: row.priceCents,
        currency: 'CAD' as const,
        startedAt,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: row.status === 'trialing' ? at(40) : undefined,
        note: row.note,
        createdAt: startedAt,
        updatedAt: at(-1),
      };
    }),
  );
}

// ─── Partners & campaigns ───────────────────────────────────────────────────

const ADVERTISERS = [
  {
    _id: 'adv_tanjia',
    name: 'Tanjia Marrakech',
    category: 'Restaurant',
    contactName: 'Youssef Benali',
    contactEmail: 'youssef@tanjiamtl.ca',
    contactPhone: '(514) 555-0182',
    website: 'tanjiamtl.ca',
    status: 'active' as const,
    note: 'Halal Moroccan on Jean-Talon. Wants Ramadan iftar traffic.',
  },
  {
    _id: 'adv_adonis',
    name: 'Marché Nour',
    category: 'Grocery',
    contactName: 'Rania Haddad',
    contactEmail: 'rania@marchenour.ca',
    website: 'marchenour.ca',
    status: 'active' as const,
    note: 'Three stores across Montréal. Renews quarterly.',
  },
  {
    _id: 'adv_ecole',
    name: 'École de Conduite Atlas',
    category: 'Education',
    contactName: 'Karim Zaoui',
    contactEmail: 'info@atlasconduite.ca',
    status: 'active' as const,
    note: 'Driving school. Targets newcomers, asked for Arabic creative.',
  },
  {
    _id: 'adv_hijabi',
    name: 'Sabr Modest Wear',
    category: 'Retail',
    contactEmail: 'hello@sabrmodest.com',
    website: 'sabrmodest.com',
    status: 'paused' as const,
    note: 'Paused after Eid — will come back for Ramadan.',
  },
];

const CAMPAIGNS = [
  {
    _id: 'camp_tanjia_iftar',
    advertiserId: 'adv_tanjia',
    name: 'Iftar family platters',
    status: 'active' as const,
    creative: {
      headline: 'Iftar platters for four, ready at sunset',
      body: 'Order by 4pm. Ten minutes from Masjid Khadija, on Jean-Talon.',
      ctaLabel: 'See the menu',
      ctaUrl: 'https://tanjiamtl.ca/iftar',
      disclosure: 'Paid partnership · Tanjia Marrakech',
    },
    targeting: { cities: ['montreal'], mosqueIds: [], interests: [], placements: ['feed'] },
    startDays: -18,
    endDays: 12,
    budgetCents: money(900),
    pricing: 'cpm' as const,
    rateCents: money(8),
    impressions: 41_200,
    clicks: 986,
  },
  {
    _id: 'camp_nour_weekly',
    advertiserId: 'adv_adonis',
    name: 'Weekly halal specials',
    status: 'active' as const,
    creative: {
      headline: 'Fresh halal lamb, $6.99/lb this week',
      body: 'Marché Nour — Saint-Laurent, Verdun and Laval. Open until 9pm.',
      ctaLabel: 'This week’s flyer',
      ctaUrl: 'https://marchenour.ca/flyer',
      disclosure: 'Paid partnership · Marché Nour',
    },
    targeting: {
      cities: ['montreal'],
      mosqueIds: [],
      interests: [],
      placements: ['feed', 'mosque-profile'],
    },
    startDays: -45,
    endDays: 45,
    budgetCents: money(2400),
    pricing: 'cpm' as const,
    rateCents: money(6),
    impressions: 128_400,
    clicks: 2_051,
  },
  {
    _id: 'camp_atlas_newcomers',
    advertiserId: 'adv_ecole',
    name: 'Newcomer driving lessons',
    status: 'pending' as const,
    creative: {
      headline: 'Learn to drive in French, English or Arabic',
      body: 'SAAQ-approved. Evening and weekend lessons in Saint-Laurent.',
      ctaLabel: 'Book a first lesson',
      ctaUrl: 'https://atlasconduite.ca/inscription',
      disclosure: 'Paid partnership · École de Conduite Atlas',
    },
    targeting: {
      cities: ['montreal'],
      mosqueIds: [],
      interests: ['education'],
      placements: ['feed'],
    },
    startDays: 3,
    endDays: 63,
    budgetCents: money(600),
    pricing: 'cpc' as const,
    rateCents: money(1.2),
    impressions: 0,
    clicks: 0,
  },
  {
    _id: 'camp_sabr_eid',
    advertiserId: 'adv_hijabi',
    name: 'Eid collection',
    status: 'completed' as const,
    creative: {
      headline: 'The Eid collection is here',
      body: 'Free shipping across Québec until the end of the month.',
      ctaLabel: 'Shop the collection',
      ctaUrl: 'https://sabrmodest.com/eid',
      disclosure: 'Paid partnership · Sabr Modest Wear',
    },
    targeting: { cities: [], mosqueIds: [], interests: [], placements: ['feed'] },
    startDays: -110,
    endDays: -75,
    budgetCents: money(1200),
    pricing: 'flat' as const,
    rateCents: 0,
    impressions: 63_900,
    clicks: 1_402,
  },
];

async function seedCampaigns(): Promise<void> {
  await upsert(
    AdvertiserModel,
    ADVERTISERS.map((a) => ({ ...a, createdAt: at(-120), updatedAt: at(-3) })),
  );

  await upsert(
    CampaignModel,
    CAMPAIGNS.map((c) => ({
      _id: c._id,
      advertiserId: c.advertiserId,
      name: c.name,
      status: c.status,
      creative: c.creative,
      targeting: c.targeting,
      startAt: at(c.startDays),
      endAt: at(c.endDays),
      budgetCents: c.budgetCents,
      pricing: c.pricing,
      rateCents: c.rateCents,
      currency: 'CAD' as const,
      impressions: c.impressions,
      clicks: c.clicks,
      spentCents:
        c.pricing === 'cpm'
          ? Math.min(c.budgetCents, Math.round((c.impressions / 1000) * c.rateCents))
          : c.pricing === 'cpc'
            ? Math.min(c.budgetCents, c.clicks * c.rateCents)
            : c.budgetCents,
      approvedBy: c.status === 'pending' ? undefined : 'user_platform_admin',
      approvedAt: c.status === 'pending' ? undefined : at(c.startDays - 2),
      createdBy: 'user_platform_admin',
      createdAt: at(c.startDays - 5),
      updatedAt: at(-2),
    })),
  );

  // Daily rollups behind the campaign charts. Spread with a fixed wobble
  // rather than `Math.random`, so two seeds of the same fixtures produce the
  // same chart and a screenshot in a deck does not go stale.
  const stats: {
    _id: string;
    campaignId: string;
    date: string;
    impressions: number;
    clicks: number;
    spentCents: number;
  }[] = [];

  for (const c of CAMPAIGNS) {
    if (!c.impressions) continue;
    const first = Math.max(c.startDays, -30);
    const last = Math.min(c.endDays, 0);
    const days = Math.max(1, last - first + 1);

    for (let i = 0; i < days; i++) {
      const day = at(first + i);
      // A weekday/weekend rhythm, because flat lines look like broken charts.
      const wobble = [0.82, 1.14, 0.95, 1.08, 1.21, 0.77, 0.9][(day.getDay() + i) % 7]!;
      const impressions = Math.round((c.impressions / days) * wobble);
      const clicks = Math.round((c.clicks / days) * wobble);
      stats.push({
        _id: `${c._id}:${day.toISOString().slice(0, 10)}`,
        campaignId: c._id,
        date: day.toISOString().slice(0, 10),
        impressions,
        clicks,
        spentCents:
          c.pricing === 'cpm'
            ? Math.round((impressions / 1000) * c.rateCents)
            : c.pricing === 'cpc'
              ? clicks * c.rateCents
              : Math.round(c.budgetCents / days),
      });
    }
  }
  await upsert(CampaignStatModel, stats);
}

// ─── Invoices, payments and donations ───────────────────────────────────────

interface InvoiceSpec {
  id: string;
  number: string;
  kind: 'subscription' | 'campaign';
  mosqueId?: string;
  advertiserId?: string;
  sourceId?: string;
  description: string;
  unitCents: number;
  quantity: number;
  issuedDaysAgo: number;
  dueInDays: number;
  paid: boolean;
  paidDaysAgo?: number;
}

const INVOICES: InvoiceSpec[] = [
  ...[3, 2, 1].map((n, i) => ({
    id: `inv_khadija_${n}`,
    number: `INV-2026-000${i + 1}`,
    kind: 'subscription' as const,
    mosqueId: KHADIJA_ID,
    sourceId: `sub_${KHADIJA_ID}`,
    description: `M'Ensemble Pro — monthly`,
    unitCents: money(129),
    quantity: 1,
    issuedDaysAgo: n * 30,
    dueInDays: 30,
    paid: true,
    paidDaysAgo: n * 30 - 4,
  })),
  {
    id: 'inv_madina_1',
    number: 'INV-2026-0004',
    kind: 'subscription',
    mosqueId: MADINA_ID,
    sourceId: `sub_${MADINA_ID}`,
    description: `M'Ensemble Standard — monthly`,
    unitCents: money(49),
    quantity: 1,
    issuedDaysAgo: 26,
    dueInDays: 30,
    paid: true,
    paidDaysAgo: 19,
  },
  {
    id: 'inv_salah_late',
    number: 'INV-2026-0005',
    kind: 'subscription',
    mosqueId: SALAHOUDDINE_ID,
    sourceId: `sub_${SALAHOUDDINE_ID}`,
    description: `M'Ensemble Standard — monthly`,
    unitCents: money(49),
    quantity: 2,
    issuedDaysAgo: 62,
    dueInDays: 30,
    paid: false,
  },
  {
    id: 'inv_fatima_1',
    number: 'INV-2026-0006',
    kind: 'subscription',
    mosqueId: FATIMA_ID,
    sourceId: `sub_${FATIMA_ID}`,
    description: `M'Ensemble Pro — monthly`,
    unitCents: money(129),
    quantity: 1,
    issuedDaysAgo: 8,
    dueInDays: 30,
    paid: false,
  },
  {
    id: 'inv_nour_q',
    number: 'INV-2026-0007',
    kind: 'campaign',
    advertiserId: 'adv_adonis',
    sourceId: 'camp_nour_weekly',
    description: 'Weekly halal specials — feed placement, 90 days',
    unitCents: money(2400),
    quantity: 1,
    issuedDaysAgo: 40,
    dueInDays: 30,
    paid: true,
    paidDaysAgo: 22,
  },
  {
    id: 'inv_tanjia_iftar',
    number: 'INV-2026-0008',
    kind: 'campaign',
    advertiserId: 'adv_tanjia',
    sourceId: 'camp_tanjia_iftar',
    description: 'Iftar platters — feed placement, 30 days',
    unitCents: money(900),
    quantity: 1,
    issuedDaysAgo: 16,
    dueInDays: 30,
    paid: false,
  },
];

async function seedInvoices(): Promise<void> {
  await upsert(
    InvoiceModel,
    INVOICES.map((spec) => {
      const amountCents = spec.unitCents * spec.quantity;
      // Québec: 5% GST + 9.975% QST, applied to the subtotal.
      const taxCents = Math.round(amountCents * 0.14975);
      const totalCents = amountCents + taxCents;
      const issuedAt = at(-spec.issuedDaysAgo);
      return {
        _id: spec.id,
        number: spec.number,
        kind: spec.kind,
        mosqueId: spec.mosqueId,
        advertiserId: spec.advertiserId,
        sourceId: spec.sourceId,
        status: spec.paid ? ('paid' as const) : ('open' as const),
        currency: 'CAD' as const,
        lines: [
          {
            description: spec.description,
            quantity: spec.quantity,
            unitCents: spec.unitCents,
            amountCents,
          },
        ],
        subtotalCents: amountCents,
        taxCents,
        totalCents,
        paidCents: spec.paid ? totalCents : 0,
        dueCents: spec.paid ? 0 : totalCents,
        issuedAt,
        dueAt: new Date(issuedAt.getTime() + spec.dueInDays * DAY),
        paidAt: spec.paid ? at(-(spec.paidDaysAgo ?? 0)) : undefined,
        createdBy: 'user_platform_admin',
        createdAt: issuedAt,
        updatedAt: at(-1),
      };
    }),
  );

  await upsert(
    PaymentModel,
    INVOICES.filter((s) => s.paid).map((spec) => {
      const amountCents = spec.unitCents * spec.quantity;
      const totalCents = amountCents + Math.round(amountCents * 0.14975);
      return {
        _id: `pay_${spec.id}`,
        invoiceId: spec.id,
        amountCents: totalCents,
        currency: 'CAD' as const,
        method: spec.kind === 'campaign' ? ('etransfer' as const) : ('etransfer' as const),
        reference: `ETR-${spec.number.slice(-4)}`,
        receivedAt: at(-(spec.paidDaysAgo ?? 0)),
        recordedBy: 'user_platform_admin',
        createdAt: at(-(spec.paidDaysAgo ?? 0)),
      };
    }),
  );

  // The invoice counter has to start above the highest seeded number, or the
  // first invoice minted in the dashboard collides on the unique index.
  await CounterModel.updateOne(
    { _id: `invoice:${new Date().getFullYear()}` },
    { $max: { seq: INVOICES.length } },
    { upsert: true },
  );
}

async function seedDonations(): Promise<void> {
  const spread: { mosqueId: string; dollars: number; daysAgo: number; donor?: string }[] = [
    { mosqueId: KHADIJA_ID, dollars: 250, daysAgo: 2, donor: 'Anonymous' },
    { mosqueId: KHADIJA_ID, dollars: 40, daysAgo: 4, donor: 'Yusuf A.' },
    { mosqueId: KHADIJA_ID, dollars: 1000, daysAgo: 11 },
    { mosqueId: MADINA_ID, dollars: 120, daysAgo: 6, donor: 'Amina T.' },
    { mosqueId: MADINA_ID, dollars: 75, daysAgo: 14 },
    { mosqueId: SALAHOUDDINE_ID, dollars: 500, daysAgo: 9, donor: 'Bilal K.' },
    { mosqueId: CIIC_ID, dollars: 60, daysAgo: 17 },
    { mosqueId: FATIMA_ID, dollars: 300, daysAgo: 21, donor: 'Mariam S.' },
    { mosqueId: VERDUN_ID, dollars: 25, daysAgo: 25 },
    { mosqueId: KHADIJA_ID, dollars: 150, daysAgo: 33 },
  ];

  await upsert(
    DonationModel,
    spread.map((d, i) => {
      const amountCents = money(d.dollars);
      const feeCents = platformFeeCents(amountCents);
      return {
        _id: `don_${String(i + 1).padStart(3, '0')}`,
        mosqueId: d.mosqueId,
        donorName: d.donor,
        amountCents,
        feeCents,
        netCents: amountCents - feeCents,
        currency: 'CAD' as const,
        status: 'settled' as const,
        method: 'etransfer' as const,
        reference: `DON-${String(i + 1).padStart(4, '0')}`,
        // The older half has been paid out; the recent ones are what we owe.
        payoutAt: d.daysAgo > 14 ? at(-(d.daysAgo - 7)) : undefined,
        createdAt: at(-d.daysAgo, 9),
      };
    }),
  );
}

// ─── Support ────────────────────────────────────────────────────────────────

async function seedTickets(): Promise<void> {
  const staff = { id: 'user_platform_admin', name: env.SUPERADMIN_NAME };

  const tickets = [
    {
      _id: 'tkt_001',
      reference: 'TKT-1001',
      subject: 'Prayer times are an hour out since the clocks changed',
      category: 'bug' as const,
      status: 'open' as const,
      priority: 'high' as const,
      userId: CURRENT_USER_ID,
      mosqueId: KHADIJA_ID,
      daysAgo: 1,
      messages: [
        {
          fromStaff: false,
          body: "Since Sunday the iqamah times in the app are an hour ahead of what's on the board at Khadija. Fajr says 06:15, the board says 05:15.",
        },
      ],
    },
    {
      _id: 'tkt_002',
      reference: 'TKT-1002',
      subject: 'Cannot sign in — says email or password incorrect',
      category: 'account' as const,
      status: 'pending' as const,
      priority: 'normal' as const,
      userId: KHADIJA_ADMIN_ID,
      mosqueId: KHADIJA_ID,
      daysAgo: 4,
      messages: [
        { fromStaff: false, body: 'I changed my password last week and now nothing works.' },
        {
          fromStaff: true,
          body: 'Reset it for you — check the email we sent. You will be asked to pick a new one on first sign-in.',
        },
      ],
    },
    {
      _id: 'tkt_003',
      reference: 'TKT-1003',
      subject: 'Invoice INV-2026-0005 — who do we pay?',
      category: 'billing' as const,
      status: 'open' as const,
      priority: 'normal' as const,
      mosqueId: SALAHOUDDINE_ID,
      daysAgo: 6,
      messages: [
        {
          fromStaff: false,
          body: 'Our treasurer changed in March and nobody knows what this invoice is for. Can you resend it with the details?',
        },
        { fromStaff: true, body: 'Two months of Standard. Sending a copy now.', internal: true },
      ],
    },
    {
      _id: 'tkt_004',
      reference: 'TKT-1004',
      subject: 'Volunteer shows as no-show but she was there',
      category: 'content' as const,
      status: 'resolved' as const,
      priority: 'normal' as const,
      mosqueId: MADINA_ID,
      daysAgo: 12,
      resolvedDaysAgo: 11,
      messages: [
        { fromStaff: false, body: 'Amina worked the whole iftar and her record says no-show.' },
        {
          fromStaff: true,
          body: 'Nobody scanned her QR on the night. Checked her in manually — her reliability is back to 100%.',
        },
      ],
    },
    {
      _id: 'tkt_005',
      reference: 'TKT-1005',
      subject: 'Can we get Arabic on the poster text?',
      category: 'feature' as const,
      status: 'open' as const,
      priority: 'low' as const,
      mosqueId: CIIC_ID,
      daysAgo: 19,
      messages: [
        {
          fromStaff: false,
          body: 'Half our congregation reads Arabic first. The app switches but the posters we upload are English only.',
        },
      ],
    },
  ];

  await upsert(
    SupportTicketModel,
    tickets.map((t) => {
      const createdAt = at(-t.daysAgo, 10);
      return {
        _id: t._id,
        reference: t.reference,
        subject: t.subject,
        category: t.category,
        status: t.status,
        priority: t.priority,
        userId: t.userId,
        mosqueId: t.mosqueId,
        assignedTo: t.status === 'open' && t.priority === 'low' ? undefined : staff.id,
        assignedToName: t.status === 'open' && t.priority === 'low' ? undefined : staff.name,
        messages: t.messages.map((m, i) => ({
          _id: `${t._id}_msg_${i + 1}`,
          authorId: m.fromStaff ? staff.id : (t.userId ?? 'unknown'),
          authorName: m.fromStaff ? staff.name : 'Reporter',
          fromStaff: m.fromStaff,
          body: m.body,
          internal: Boolean((m as { internal?: boolean }).internal),
          createdAt: new Date(createdAt.getTime() + i * 3 * 60 * 60 * 1000),
        })),
        createdAt,
        updatedAt: new Date(createdAt.getTime() + (t.messages.length - 1) * 3 * 60 * 60 * 1000),
        resolvedAt: t.resolvedDaysAgo ? at(-t.resolvedDaysAgo) : undefined,
        resolutionHours: t.resolvedDaysAgo ? (t.daysAgo - t.resolvedDaysAgo) * 24 : undefined,
      };
    }),
  );

  await CounterModel.updateOne(
    { _id: 'ticket' },
    { $max: { seq: tickets.length } },
    { upsert: true },
  );
}

// ─── The activity log ───────────────────────────────────────────────────────

/**
 * A history for the activity log.
 *
 * Without this the log is empty on a fresh database, and an empty log reads as
 * a broken feature rather than a new one — the first thing anybody does with
 * that screen is wonder whether it works. Every row below corresponds to
 * something the seed above actually did, so the log is not fiction: it is the
 * record of the seeding, written the way the service would have written it.
 *
 * Real rows are appended by `audit.service` from here on. These are seeded with
 * fixed ids so a re-seed refreshes them rather than stacking up duplicates.
 */
async function seedAuditHistory(): Promise<void> {
  const actor = { id: 'user_platform_admin', name: env.SUPERADMIN_NAME };

  const entries: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    summary: string;
    daysAgo: number;
    hour?: number;
  }[] = [
    ...PLAN_ROWS.map((row, i) => ({
      id: `audit_mosque_${i + 1}`,
      action: 'subscription.created',
      targetType: 'subscription',
      targetId: `sub_${row.mosqueId}`,
      summary: `Started the ${row.plan} plan for ${row.mosqueId}`,
      daysAgo: row.startedDaysAgo,
      hour: 10,
    })),
    ...ADVERTISERS.map((a, i) => ({
      id: `audit_adv_${i + 1}`,
      action: 'advertiser.created',
      targetType: 'advertiser',
      targetId: a._id,
      summary: `Added partner ${a.name} (${a.category})`,
      daysAgo: 120 - i * 3,
      hour: 14,
    })),
    ...CAMPAIGNS.filter((c) => c.status !== 'pending').map((c, i) => ({
      id: `audit_camp_${i + 1}`,
      action: 'campaign.active',
      targetType: 'campaign',
      targetId: c._id,
      summary: `Campaign "${c.name}": pending → active`,
      daysAgo: Math.abs(c.startDays) + 2,
      hour: 11,
    })),
    ...INVOICES.map((inv, i) => ({
      id: `audit_inv_${i + 1}`,
      action: 'invoice.issued',
      targetType: 'invoice',
      targetId: inv.id,
      summary: `Issued ${inv.number} for ${((inv.unitCents * inv.quantity) / 100).toFixed(2)} CAD`,
      daysAgo: inv.issuedDaysAgo,
      hour: 9,
    })),
    ...INVOICES.filter((inv) => inv.paid).map((inv, i) => ({
      id: `audit_pay_${i + 1}`,
      action: 'invoice.payment_recorded',
      targetType: 'invoice',
      targetId: inv.id,
      summary: `Recorded payment against ${inv.number} (etransfer)`,
      daysAgo: inv.paidDaysAgo ?? 0,
      hour: 15,
    })),
  ];

  await upsert(
    AuditEntryModel,
    entries.map((e) => ({
      _id: e.id,
      actorId: actor.id,
      actorName: actor.name,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      summary: e.summary,
      createdAt: at(-e.daysAgo, e.hour ?? 12),
    })),
  );
}

// ─── Entry point ────────────────────────────────────────────────────────────

export interface PlatformSeedCounts {
  subscriptions: number;
  invoices: number;
  payments: number;
  donations: number;
  advertisers: number;
  campaigns: number;
  tickets: number;
  auditEntries: number;
  superAdmin: string;
}

export async function seedPlatform(bcryptRounds = 10): Promise<PlatformSeedCounts> {
  const admin = await seedSuperAdmin(bcryptRounds);

  await backdateUsers();
  await seedSubscriptions();
  await seedCampaigns();
  await seedInvoices();
  await seedDonations();
  await seedTickets();
  await seedAuditHistory();

  // Counted only so the seed's output says what it wrote.
  const [
    subscriptions,
    invoices,
    payments,
    donations,
    advertisers,
    campaigns,
    tickets,
    auditEntries,
  ] = await Promise.all([
    SubscriptionModel.countDocuments(),
    InvoiceModel.countDocuments(),
    PaymentModel.countDocuments(),
    DonationModel.countDocuments(),
    AdvertiserModel.countDocuments(),
    CampaignModel.countDocuments(),
    SupportTicketModel.countDocuments(),
    AuditEntryModel.countDocuments(),
  ]);

  return {
    subscriptions,
    invoices,
    payments,
    donations,
    advertisers,
    campaigns,
    tickets,
    auditEntries,
    superAdmin: `${admin.email}${admin.created ? ' (created)' : ' (promoted)'}`,
  };
}
