import type {
  DailyPoint,
  Donation,
  Invoice,
  MosqueDetail,
  MosqueSummary,
  PageQuery,
  PageResult,
  PlanId,
  PlatformAlert,
  PlatformOverview,
  Subscription,
  SubscriptionStatus,
  TrendStat,
} from '@m-ensemble/shared';
import { FollowModel } from '../models/Follow.js';
import { MembershipModel } from '../models/Membership.js';
import { MosqueModel } from '../models/Mosque.js';
import { PostModel } from '../models/Post.js';
import { SignupModel } from '../models/Signup.js';
import { UserModel } from '../models/User.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { InvoiceModel } from '../models/Invoice.js';
import { DonationModel } from '../models/Donation.js';
import { CampaignModel } from '../models/Campaign.js';
import { SupportTicketModel } from '../models/SupportTicket.js';
import { cityNameById, monthlyValueCents, mosqueCityId } from '../shared.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { asContract } from '../utils/serialize.js';
import { DAY_MS } from '../utils/time.js';
import { pageResult, resolvePage, searchRegex } from '../utils/paging.js';

/**
 * Everything the super admin's screens count.
 *
 * Every number here is **derived on read** from the same collections the app
 * writes. There is no statistics table, so there is nothing to fall out of
 * sync and no backfill to run when a formula changes. At this volume — dozens
 * of mosques, thousands of signups — that is a handful of aggregations, and
 * the honesty is worth more than the milliseconds.
 *
 * **What a `TrendStat` means here.** `users`, `mosques`, `posts`, `signups`
 * and `checkIns` are cumulative totals, and `previous` is that same total as it
 * stood 30 days ago — so `changePct` reads as growth over the last month.
 * `activeMosques` is the exception and is a window: mosques with any post or
 * signup in the last 30 days, against the 30 days before that. A cumulative
 * "has ever been active" would only ever go up and would tell nobody anything.
 */

const WINDOW_DAYS = 30;

function trend(total: number, totalBefore: number): TrendStat {
  return {
    value: total,
    previous: totalBefore,
    // Undefined rather than Infinity when there was nothing to grow from. The
    // dashboard renders a dash; "+∞%" on the first week is noise, not a signal.
    changePct: totalBefore > 0 ? Math.round(((total - totalBefore) / totalBefore) * 100) : null,
  };
}

/** `YYYY-MM-DD` in UTC. The charts are day-grained; an hour of skew is noise. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── The overview ───────────────────────────────────────────────────────────

export async function buildOverview(): Promise<PlatformOverview> {
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_DAYS * DAY_MS);
  const priorStart = new Date(now - 2 * WINDOW_DAYS * DAY_MS);

  const [
    users,
    usersBefore,
    mosques,
    mosquesBefore,
    posts,
    postsBefore,
    signups,
    signupsBefore,
    checkIns,
    checkInsBefore,
    campaignsLive,
    ticketsOpen,
  ] = await Promise.all([
    UserModel.countDocuments({}),
    UserModel.countDocuments({ createdAt: { $lt: windowStart } }),
    MosqueModel.countDocuments({}),
    // Directory mosques carry no `createdAt` — they were never onboarded, they
    // were imported. Counting them as "already there" is the truthful answer.
    MosqueModel.countDocuments({
      $or: [{ createdAt: { $lt: windowStart } }, { createdAt: { $exists: false } }],
    }),
    PostModel.countDocuments({}),
    PostModel.countDocuments({ createdAt: { $lt: windowStart } }),
    SignupModel.countDocuments({}),
    SignupModel.countDocuments({ createdAt: { $lt: windowStart } }),
    SignupModel.countDocuments({ checkedInAt: { $exists: true } }),
    SignupModel.countDocuments({ checkedInAt: { $lt: windowStart } }),
    CampaignModel.countDocuments({ status: 'active' }),
    SupportTicketModel.countDocuments({ status: { $in: ['open', 'pending'] } }),
  ]);

  const [activeNow, activePrior] = await Promise.all([
    activeMosqueIds(windowStart, new Date(now)),
    activeMosqueIds(priorStart, windowStart),
  ]);

  const [money, attendance, daily, summaries] = await Promise.all([
    moneyTotals(windowStart),
    attendanceRate(windowStart),
    dailySeries(WINDOW_DAYS),
    mosqueSummaries(),
  ]);

  const topMosques = [...summaries]
    .filter((m) => m.operated)
    .sort((a, b) => b.signupCount - a.signupCount || b.followerCount - a.followerCount)
    .slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    users: trend(users, usersBefore),
    mosques: trend(mosques, mosquesBefore),
    activeMosques: trend(activeNow.size, activePrior.size),
    posts: trend(posts, postsBefore),
    signups: trend(signups, signupsBefore),
    checkIns: trend(checkIns, checkInsBefore),
    ...money,
    campaignsLive,
    ticketsOpen,
    attendanceRate30d: attendance,
    daily,
    topMosques,
    alerts: await buildAlerts(summaries),
  };
}

/** Mosques with a post created or a signup claimed inside the window. */
async function activeMosqueIds(from: Date, to: Date): Promise<Set<string>> {
  const [postMosques, signupPosts] = await Promise.all([
    PostModel.distinct('mosqueId', { createdAt: { $gte: from, $lt: to } }),
    SignupModel.distinct('postId', { createdAt: { $gte: from, $lt: to } }),
  ]);
  const fromSignups = signupPosts.length
    ? await PostModel.distinct('mosqueId', { _id: { $in: signupPosts } })
    : [];
  return new Set<string>([...postMosques, ...fromSignups]);
}

/** MRR, what is owed us, and what actually came in. */
async function moneyTotals(windowStart: Date): Promise<{
  mrrCents: number;
  outstandingCents: number;
  collected30dCents: number;
}> {
  const [subs, outstanding, collected] = await Promise.all([
    SubscriptionModel.find({ status: { $in: ['active', 'trialing'] } }),
    InvoiceModel.aggregate<{ total: number }>([
      { $match: { status: { $in: ['open', 'uncollectible'] } } },
      { $group: { _id: null, total: { $sum: '$dueCents' } } },
    ]),
    InvoiceModel.aggregate<{ total: number }>([
      { $match: { paidAt: { $gte: windowStart } } },
      { $group: { _id: null, total: { $sum: '$paidCents' } } },
    ]),
  ]);

  return {
    mrrCents: subs.reduce((sum, s) => sum + monthlyValueCents(s), 0),
    outstandingCents: outstanding[0]?.total ?? 0,
    collected30dCents: collected[0]?.total ?? 0,
  };
}

/** Checked-in ÷ confirmed across every mosque, over posts that have ended. */
async function attendanceRate(windowStart: Date): Promise<number> {
  const endedIds = await PostModel.distinct('_id', {
    cancelledAt: { $exists: false },
    endAt: { $gte: windowStart, $lt: new Date() },
  });
  if (!endedIds.length) return 0;

  const [confirmed, attended] = await Promise.all([
    SignupModel.countDocuments({ postId: { $in: endedIds }, status: 'confirmed' }),
    SignupModel.countDocuments({
      postId: { $in: endedIds },
      status: 'confirmed',
      checkedInAt: { $exists: true },
    }),
  ]);
  return confirmed ? Math.round((attended / confirmed) * 100) : 0;
}

/**
 * Daily activity, oldest first, with **every day present** — including the
 * quiet ones. A series that skips empty days draws a chart where a dead week
 * looks like a busy one, because the line just carries on to the next point.
 */
export async function dailySeries(days: number, mosqueId?: string): Promise<DailyPoint[]> {
  const from = new Date(Date.now() - days * DAY_MS);
  const postScope = mosqueId ? { mosqueId } : {};

  // Scoped to one mosque, signups have to be filtered through its posts —
  // `Signup` carries no mosqueId, and denormalising one for a chart would be a
  // migration paying for a convenience.
  const postIds = mosqueId ? await PostModel.distinct('_id', { mosqueId }) : null;
  const signupScope = postIds ? { postId: { $in: postIds } } : {};

  const byDay = (rows: { _id: string; n: number }[]): Map<string, number> =>
    new Map(rows.map((r) => [r._id, r.n]));

  const group = (field: string) => [
    {
      $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}` } }, n: { $sum: 1 } },
    },
  ];

  const [signups, posts, users, checkIns] = await Promise.all([
    SignupModel.aggregate<{ _id: string; n: number }>([
      { $match: { ...signupScope, createdAt: { $gte: from } } },
      ...group('createdAt'),
    ]),
    PostModel.aggregate<{ _id: string; n: number }>([
      { $match: { ...postScope, createdAt: { $gte: from } } },
      ...group('createdAt'),
    ]),
    // Platform-wide only: a mosque does not "have" new users, it has followers.
    mosqueId
      ? Promise.resolve([])
      : UserModel.aggregate<{ _id: string; n: number }>([
          { $match: { createdAt: { $gte: from } } },
          ...group('createdAt'),
        ]),
    SignupModel.aggregate<{ _id: string; n: number }>([
      { $match: { ...signupScope, checkedInAt: { $gte: from } } },
      ...group('checkedInAt'),
    ]),
  ]);

  const s = byDay(signups);
  const p = byDay(posts);
  const u = byDay(users);
  const c = byDay(checkIns);

  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(new Date(Date.now() - i * DAY_MS));
    out.push({
      date,
      signups: s.get(date) ?? 0,
      posts: p.get(date) ?? 0,
      newUsers: u.get(date) ?? 0,
      checkIns: c.get(date) ?? 0,
    });
  }
  return out;
}

// ─── Mosque summaries ───────────────────────────────────────────────────────

/**
 * One row per mosque, for the mosque table and the overview leaderboard.
 *
 * Built with six collection-wide aggregations and joined in memory rather than
 * one query per mosque. With a couple of hundred directory rows, the N+1 shape
 * would be a thousand round trips for a screen someone opens constantly.
 */
export async function mosqueSummaries(): Promise<MosqueSummary[]> {
  const now = new Date();

  const [mosques, follows, memberships, postAgg, signupAgg, subs, invoiceAgg] = await Promise.all([
    MosqueModel.find({}),
    FollowModel.aggregate<{ _id: string; n: number }>([
      { $group: { _id: '$mosqueId', n: { $sum: 1 } } },
    ]),
    MembershipModel.aggregate<{ _id: { mosqueId: string; role: string }; n: number }>([
      { $group: { _id: { mosqueId: '$mosqueId', role: '$role' }, n: { $sum: 1 } } },
    ]),
    PostModel.aggregate<{ _id: string; total: number; live: number; last: Date | null }>([
      {
        $group: {
          _id: '$mosqueId',
          total: { $sum: 1 },
          live: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ['$endAt', now] },
                    { $eq: [{ $type: '$cancelledAt' }, 'missing'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          last: { $max: '$createdAt' },
        },
      },
    ]),
    // Signups carry a postId, not a mosqueId — the join has to happen here.
    SignupModel.aggregate<{
      _id: string;
      total: number;
      confirmedEnded: number;
      attended: number;
      last: Date | null;
    }>([
      { $lookup: { from: 'posts', localField: 'postId', foreignField: '_id', as: 'post' } },
      { $unwind: '$post' },
      {
        $group: {
          _id: '$post.mosqueId',
          total: { $sum: 1 },
          confirmedEnded: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'confirmed'] }, { $lt: ['$post.endAt', now] }] },
                1,
                0,
              ],
            },
          },
          attended: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'confirmed'] },
                    { $lt: ['$post.endAt', now] },
                    { $ne: [{ $type: '$checkedInAt' }, 'missing'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          last: { $max: '$createdAt' },
        },
      },
    ]),
    SubscriptionModel.find({}),
    InvoiceModel.aggregate<{ _id: string; due: number }>([
      { $match: { status: { $in: ['open', 'uncollectible'] }, mosqueId: { $exists: true } } },
      { $group: { _id: '$mosqueId', due: { $sum: '$dueCents' } } },
    ]),
  ]);

  const followers = new Map(follows.map((f) => [f._id, f.n]));
  const admins = new Map<string, number>();
  const members = new Map<string, number>();
  for (const m of memberships) {
    const target = m._id.role === 'admin' ? admins : members;
    target.set(m._id.mosqueId, (target.get(m._id.mosqueId) ?? 0) + m.n);
  }
  const postsBy = new Map(postAgg.map((p) => [p._id, p]));
  const signupsBy = new Map(signupAgg.map((s) => [s._id, s]));
  const subBy = new Map(subs.map((s) => [s.mosqueId, s]));
  const dueBy = new Map(invoiceAgg.map((i) => [i._id, i.due]));

  return mosques.map((mosque): MosqueSummary => {
    const id = mosque._id;
    const p = postsBy.get(id);
    const s = signupsBy.get(id);
    const sub = subBy.get(id);
    const coordinatorCount = admins.get(id) ?? 0;

    // Two candidate "last activity" timestamps; the later one is the answer.
    const lastActivity = [p?.last, s?.last]
      .filter((d): d is Date => d instanceof Date)
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      mosqueId: id,
      name: mosque.name,
      city: cityNameById(mosqueCityId(mosque)),
      // Operated means somebody runs it, which is exactly "has a coordinator".
      // Not `isOperatedMosque` from the fixtures — that is a hardcoded list and
      // would call every mosque onboarded through this dashboard unoperated.
      operated: coordinatorCount > 0,
      plan: (sub?.plan ?? 'free') as PlanId,
      subscriptionStatus: (sub?.status ?? 'cancelled') as SubscriptionStatus,
      coordinatorCount,
      followerCount: followers.get(id) ?? 0,
      memberCount: (members.get(id) ?? 0) + coordinatorCount,
      postCount: p?.total ?? 0,
      livePostCount: p?.live ?? 0,
      signupCount: s?.total ?? 0,
      attendanceRate: s?.confirmedEnded ? Math.round((s.attended / s.confirmedEnded) * 100) : 0,
      lastActivityAt: lastActivity?.toISOString(),
      createdAt: mosque.createdAt?.toISOString(),
      outstandingCents: dueBy.get(id) ?? 0,
    };
  });
}

/** The mosque table: search, sort and page over the summaries above. */
export async function listMosques(
  query: PageQuery & { operated?: boolean; plan?: PlanId; city?: string },
): Promise<PageResult<MosqueSummary>> {
  const resolved = resolvePage(query);
  let rows = await mosqueSummaries();

  const rx = searchRegex(query.q);
  if (rx) rows = rows.filter((r) => rx.test(r.name) || rx.test(r.city));
  if (query.operated !== undefined) rows = rows.filter((r) => r.operated === query.operated);
  if (query.plan) rows = rows.filter((r) => r.plan === query.plan);
  if (query.city) rows = rows.filter((r) => r.city === query.city);

  const key = (query.sort ?? 'signupCount') as keyof MosqueSummary;
  const dir = query.dir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
    return String(x ?? '').localeCompare(String(y ?? '')) * dir;
  });

  // Filtered and sorted in memory because `operated`, `city` and
  // `attendanceRate` are all derived — none of them is a stored field a Mongo
  // sort could reach. The set is one row per mosque, so this stays cheap.
  return pageResult(
    rows.slice(resolved.skip, resolved.skip + resolved.limit),
    rows.length,
    resolved,
  );
}

// ─── One mosque, in full ────────────────────────────────────────────────────

export async function mosqueDetail(mosqueId: string): Promise<MosqueDetail> {
  const mosque = await MosqueModel.findById(mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');

  const summaries = await mosqueSummaries();
  const summary = summaries.find((s) => s.mosqueId === mosqueId);
  if (!summary) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');

  const [subscription, adminMemberships, invoices, donations, posts, daily] = await Promise.all([
    SubscriptionModel.findOne({ mosqueId }),
    MembershipModel.find({ mosqueId, role: 'admin' }).sort({ createdAt: 1 }),
    InvoiceModel.find({ mosqueId }).sort({ issuedAt: -1 }).limit(50),
    DonationModel.find({ mosqueId }).sort({ createdAt: -1 }).limit(50),
    PostModel.find({ mosqueId }).sort({ startAt: -1 }).limit(20),
    dailySeries(30, mosqueId),
  ]);

  const coordinators = await UserModel.find({
    _id: { $in: adminMemberships.map((m) => m.userId) },
  });
  const joinedAt = new Map(adminMemberships.map((m) => [m.userId, m.createdAt]));
  const signupCounts = await SignupModel.aggregate<{ _id: string; n: number }>([
    { $match: { postId: { $in: posts.map((p) => p._id) }, status: 'confirmed' } },
    { $group: { _id: '$postId', n: { $sum: 1 } } },
  ]);
  const signupsByPost = new Map(signupCounts.map((s) => [s._id, s.n]));

  return {
    mosque: {
      ...(mosque.toJSON() as MosqueDetail['mosque']),
      city: summary.city,
      timezone: mosque.timezone,
    },
    summary,
    subscription: subscription ? asContract<Subscription>(subscription) : null,
    coordinators: coordinators.map((u) => ({
      userId: u._id,
      name: u.name,
      email: u.email,
      joinedAt: (joinedAt.get(u._id) ?? new Date()).toISOString(),
    })),
    invoices: invoices.map((i) => asContract<Invoice>(i)),
    donations: donations.map((d) => asContract<Donation>(d)),
    recentPosts: posts.map((p) => ({
      _id: p._id,
      title: p.title,
      type: p.type,
      startAt: p.startAt.toISOString(),
      cancelledAt: p.cancelledAt?.toISOString(),
      signupCount: signupsByPost.get(p._id) ?? 0,
    })),
    daily,
  };
}

// ─── Alerts ─────────────────────────────────────────────────────────────────

/**
 * What wants a human, worst first.
 *
 * Derived every time the overview is built and never stored — an alert that has
 * been dealt with simply stops being computed, which means there is no state to
 * clear and no way to end up staring at a warning about something already fixed.
 */
async function buildAlerts(summaries: MosqueSummary[]): Promise<PlatformAlert[]> {
  const now = Date.now();
  const alerts: PlatformAlert[] = [];

  const overdue = await InvoiceModel.find({ status: 'open', dueAt: { $lt: new Date() } })
    .sort({ dueAt: 1 })
    .limit(10);
  for (const inv of overdue) {
    const days = Math.floor((now - inv.dueAt.getTime()) / DAY_MS);
    alerts.push({
      id: `invoice-${inv._id}`,
      severity: days > 30 ? 'critical' : 'warn',
      kind: 'invoice-overdue',
      title: `${inv.number} is ${days} day${days === 1 ? '' : 's'} overdue`,
      detail: `${(inv.dueCents / 100).toFixed(2)} CAD outstanding.`,
      href: `/billing/invoices/${inv._id}`,
    });
  }

  const stale = await SupportTicketModel.find({
    status: { $in: ['open', 'pending'] },
    updatedAt: { $lt: new Date(now - 3 * DAY_MS) },
  })
    .sort({ updatedAt: 1 })
    .limit(10);
  for (const t of stale) {
    const days = Math.floor((now - t.updatedAt.getTime()) / DAY_MS);
    alerts.push({
      id: `ticket-${t._id}`,
      severity: t.priority === 'urgent' ? 'critical' : 'warn',
      kind: 'ticket-stale',
      title: `${t.reference} has had no reply for ${days} days`,
      detail: t.subject,
      href: `/support/${t._id}`,
    });
  }

  // Only operated mosques: a directory row going quiet is not a problem, it is
  // what a directory row is.
  for (const m of summaries) {
    if (!m.operated) continue;
    const last = m.lastActivityAt ? new Date(m.lastActivityAt).getTime() : 0;
    if (now - last > 60 * DAY_MS) {
      alerts.push({
        id: `inactive-${m.mosqueId}`,
        severity: 'warn',
        kind: 'mosque-inactive',
        title: `${m.name} has posted nothing in 60 days`,
        detail: m.lastActivityAt
          ? `Last activity ${new Date(m.lastActivityAt).toDateString()}.`
          : 'No posts or signups on record.',
        href: `/mosques/${m.mosqueId}`,
      });
    }
  }

  const overspent = await CampaignModel.find({
    status: 'active',
    $expr: { $gte: ['$spentCents', '$budgetCents'] },
  }).limit(10);
  for (const c of overspent) {
    alerts.push({
      id: `campaign-${c._id}`,
      severity: 'warn',
      kind: 'campaign-overspend',
      title: `${c.name} has spent its budget`,
      detail: 'Still serving. Pause it or raise the budget.',
      href: `/campaigns/${c._id}`,
    });
  }

  const order = { critical: 0, warn: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 20);
}
