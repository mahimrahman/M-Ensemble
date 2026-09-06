/**
 * The platform tier — what the super admin sees and operates.
 *
 * Everything in `types.ts` is scoped to one mosque: a coordinator's dashboard
 * answers "how is Khadija doing". Everything here is scoped to the *platform*:
 * how many mosques, who is paying, which campaigns are running, what is broken
 * for whom. The two never merge — a mosque admin must not be able to reach any
 * of this, and the guard for that is `requireSuperAdmin`, not a UI decision.
 *
 * **Money is integer cents.** Never a float: 0.1 + 0.2 in an invoice total is a
 * rounding bug someone finds in a bank reconciliation six months later.
 */

import type { DateString, ID, Mosque, PostType, Timestamp, User } from './types';

/** Every amount in this file is CAD unless the row says otherwise. */
export type Currency = 'CAD' | 'USD';

export const DEFAULT_CURRENCY: Currency = 'CAD';

// ─── Platform roles ─────────────────────────────────────────────────────────

/**
 * A tier *above* `Membership.role`, and deliberately on `User` rather than in
 * a collection: it is not scoped to a mosque, so there is nothing to key it by.
 *
 * `support` can read everything and act on tickets and users; only `superadmin`
 * can move money, issue mosque credentials, or grant another platform role.
 * The split exists so a volunteer answering the inbox is not one misclick away
 * from voiding an invoice.
 */
export type PlatformRole = 'none' | 'support' | 'superadmin';

export const PLATFORM_ROLES: readonly PlatformRole[] = ['none', 'support', 'superadmin'];

/**
 * Whether the account can sign in at all. Suspension is reversible and keeps
 * every row the person created — deleting a user would orphan their signups
 * and silently change six mosques' attendance numbers.
 */
export type UserStatus = 'active' | 'suspended';

/** A user as the super admin sees them: the account plus its platform reach. */
export interface PlatformUser extends User {
  platformRole: PlatformRole;
  status: UserStatus;
  createdAt: Timestamp;
  /** Set when an account was provisioned rather than self-registered. */
  mustChangePassword?: boolean;
  lastLoginAt?: Timestamp;
  /** Mosques they hold a role at, resolved for the table. */
  memberships: { mosqueId: ID; mosqueName: string; role: 'member' | 'admin' }[];
  followCount: number;
  signupCount: number;
}

// ─── Mosque provisioning ────────────────────────────────────────────────────

/**
 * Creating a mosque and creating the account that runs it are one action.
 *
 * Before this existed, coordinator access came off `COORDINATOR_EMAILS`, a
 * literal in the fixtures — onboarding a mosque meant editing source and
 * shipping. This replaces that: the super admin fills in the mosque, names the
 * coordinator, and the server mints both plus the admin `Membership` in one go.
 */
export interface CreateMosqueInput {
  name: string;
  address: string;
  coordinates: { lat: number; lng: number };
  city?: string;
  timezone?: string;
  bio?: string;
  website?: string;
  phone?: string;
  /** Omit to have the server mint one. */
  joinCode?: string;
  prayerConfig?: Mosque['prayerConfig'];
  /** Provision the coordinator in the same call. */
  coordinator?: CoordinatorInput;
  /** Start them on a plan. Defaults to `free`. */
  plan?: PlanId;
}

export interface CoordinatorInput {
  name: string;
  email: string;
  /** Omit to have the server generate one and hand it back once. */
  password?: string;
}

/**
 * The one and only time a provisioned password is readable.
 *
 * It is returned from the mint call and never stored in the clear, so it
 * cannot be looked up afterwards — a lost one is reset, not recovered. The
 * dashboard shows it once, with a copy button and a warning that says so.
 */
export interface IssuedCredential {
  userId: ID;
  mosqueId: ID;
  name: string;
  email: string;
  /** Plaintext, this response only. Never persisted, never logged. */
  password: string;
  mustChangePassword: true;
}

// ─── Platform-wide statistics ───────────────────────────────────────────────

/** A number with the direction it is moving — every tile on the overview. */
export interface TrendStat {
  value: number;
  /** Same window, the period before. Null when there is no history to compare. */
  previous: number | null;
  /** Rounded percentage change against `previous`. Null when `previous` is 0. */
  changePct: number | null;
}

/** One day of the platform's activity, for the overview's charts. */
export interface DailyPoint {
  date: DateString;
  signups: number;
  posts: number;
  newUsers: number;
  checkIns: number;
}

/**
 * The super admin's home screen, in one round trip.
 *
 * Derived on read from the same collections everything else uses — there is no
 * stats table to fall out of sync. Volume is small enough that this is a
 * handful of counts and one aggregation.
 */
export interface PlatformOverview {
  generatedAt: Timestamp;
  users: TrendStat;
  mosques: TrendStat;
  /** Mosques with at least one live post — operated, not just listed. */
  activeMosques: TrendStat;
  posts: TrendStat;
  signups: TrendStat;
  checkIns: TrendStat;
  /** Recurring revenue across active subscriptions, normalised to a month. */
  mrrCents: number;
  /** Invoiced and not yet paid, across every kind. */
  outstandingCents: number;
  /** Collected in the last 30 days. */
  collected30dCents: number;
  campaignsLive: number;
  ticketsOpen: number;
  /** Attendance across every mosque, last 30 days, 0–100. */
  attendanceRate30d: number;
  /** 30 days of activity, oldest first. */
  daily: DailyPoint[];
  /** The mosques doing the most, for the leaderboard. */
  topMosques: MosqueSummary[];
  /** Things that want a human: unpaid invoices, empty mosques, open tickets. */
  alerts: PlatformAlert[];
}

/** One mosque's row in the super admin's mosque table. */
export interface MosqueSummary {
  mosqueId: ID;
  name: string;
  city: string;
  /** False for directory-only rows: public data, no account, no coordinator. */
  operated: boolean;
  plan: PlanId;
  subscriptionStatus: SubscriptionStatus;
  coordinatorCount: number;
  followerCount: number;
  memberCount: number;
  postCount: number;
  livePostCount: number;
  signupCount: number;
  attendanceRate: number;
  /** Most recent post or signup here — how alive the account actually is. */
  lastActivityAt?: Timestamp;
  createdAt?: Timestamp;
  outstandingCents: number;
}

/**
 * Something on the platform that needs attention, ranked so the overview can
 * show the worst first. Derived, never stored — an alert that is fixed simply
 * stops being computed.
 */
export interface PlatformAlert {
  id: string;
  severity: 'info' | 'warn' | 'critical';
  kind:
    | 'invoice-overdue'
    | 'mosque-inactive'
    | 'ticket-stale'
    | 'campaign-overspend'
    | 'no-coordinator';
  title: string;
  detail: string;
  /** Where the dashboard should send someone who clicks it. */
  href?: string;
}

// ─── Subscriptions (mosque → us) ────────────────────────────────────────────

export type PlanId = 'free' | 'standard' | 'pro';

export interface Plan {
  id: PlanId;
  name: string;
  /** Per month, in cents. `free` is 0. */
  priceCents: number;
  description: string;
  features: string[];
}

/**
 * The three tiers from the pitch: free for small musallahs, paid above that.
 * Prices live in the contract so the dashboard, the invoice generator and any
 * future pricing page cannot disagree about what a plan costs.
 */
export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    description: 'For small musallahs finding their feet.',
    features: ['Up to 5 live posts', 'Prayer times & iqamah', 'Push announcements'],
  },
  {
    id: 'standard',
    name: 'Standard',
    priceCents: 4900,
    description: 'The coordinator toolkit, for a mosque running a weekly programme.',
    features: [
      'Unlimited posts',
      'Volunteer roster & QR check-in',
      'Member reliability records',
      'Event outcomes',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceCents: 12900,
    description: 'Multi-coordinator mosques with a real programme calendar.',
    features: [
      'Everything in Standard',
      'Multiple coordinators',
      'Priority support',
      'Campaign revenue share',
    ],
  },
];

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled';

export type BillingInterval = 'monthly' | 'yearly';

/**
 * What a mosque is on, and until when.
 *
 * **No processor is wired.** `status` is moved by a human in the dashboard and
 * by the invoice it is attached to — this pass models the money, it does not
 * charge for it. `externalRef` is the empty seat a Stripe subscription id slots
 * into later without a migration.
 */
export interface Subscription {
  _id: ID;
  mosqueId: ID;
  plan: PlanId;
  status: SubscriptionStatus;
  interval: BillingInterval;
  /**
   * What this mosque is actually charged — may differ from the plan's list
   * price, because mosques get discounted and comped all the time.
   */
  priceCents: number;
  currency: Currency;
  startedAt: Timestamp;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  trialEndsAt?: Timestamp;
  cancelledAt?: Timestamp;
  /** Free text: "sponsor-funded pilot", "waived until they have 50 members". */
  note?: string;
  /** Reserved for the processor's id when one is connected. */
  externalRef?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSubscriptionInput {
  mosqueId: ID;
  plan: PlanId;
  interval?: BillingInterval;
  /** Defaults to the plan's list price for the interval. */
  priceCents?: number;
  status?: SubscriptionStatus;
  trialDays?: number;
  note?: string;
}

export type UpdateSubscriptionInput = Partial<
  Pick<Subscription, 'plan' | 'status' | 'interval' | 'priceCents' | 'note' | 'currentPeriodEnd'>
>;

// ─── Invoices & payments ────────────────────────────────────────────────────

/** Why this invoice exists — which of the three money flows it belongs to. */
export type InvoiceKind = 'subscription' | 'campaign' | 'donation_fee' | 'other';

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitCents: number;
  /**
   * `quantity * unitCents`, computed server-side and stored so a later price
   * change cannot rewrite history.
   */
  amountCents: number;
}

/**
 * A bill. Either a mosque owes it (subscription) or an advertiser does
 * (campaign) — exactly one of `mosqueId` / `advertiserId` is set, which the
 * server enforces rather than trusting the caller.
 */
export interface Invoice {
  _id: ID;
  /** Human-facing, sequential per year: `INV-2026-0042`. */
  number: string;
  kind: InvoiceKind;
  mosqueId?: ID;
  advertiserId?: ID;
  /** The subscription or campaign this bills for, when there is one. */
  sourceId?: ID;
  status: InvoiceStatus;
  currency: Currency;
  lines: InvoiceLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  /** Sum of the payments recorded against it. */
  paidCents: number;
  /** `totalCents - paidCents`, never below zero. */
  dueCents: number;
  issuedAt: Timestamp;
  dueAt: Timestamp;
  paidAt?: Timestamp;
  voidedAt?: Timestamp;
  note?: string;
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateInvoiceInput {
  kind: InvoiceKind;
  mosqueId?: ID;
  advertiserId?: ID;
  sourceId?: ID;
  lines: Omit<InvoiceLine, 'amountCents'>[];
  /** Cents, not a rate — the caller decides GST/QST, we only record it. */
  taxCents?: number;
  currency?: Currency;
  dueInDays?: number;
  note?: string;
  /** Issue it straight away instead of leaving it a draft. */
  issue?: boolean;
}

/**
 * How money actually arrived. `manual` is the honest default while no processor
 * is connected: somebody was paid by transfer or cheque and recorded it here.
 */
export type PaymentMethod = 'manual' | 'etransfer' | 'cheque' | 'cash' | 'card' | 'other';

export interface Payment {
  _id: ID;
  invoiceId: ID;
  amountCents: number;
  currency: Currency;
  method: PaymentMethod;
  /** Cheque number, e-transfer confirmation, processor charge id. */
  reference?: string;
  receivedAt: Timestamp;
  /**
   * The super admin who recorded it — this is a hand-entered fact, so it is
   * attributable by design.
   */
  recordedBy: ID;
  note?: string;
  createdAt: Timestamp;
}

export interface RecordPaymentInput {
  amountCents: number;
  method: PaymentMethod;
  reference?: string;
  receivedAt?: Timestamp;
  note?: string;
}

// ─── Donations (user → mosque, we take a fee) ───────────────────────────────

export type DonationStatus = 'pending' | 'settled' | 'refunded' | 'failed';

/**
 * Money passing through us to a mosque. Recorded, not processed — every row
 * today is entered by hand or imported, and `status` is moved by a human.
 *
 * `feeCents` is our cut and `netCents` is what the mosque is owed; both are
 * stored rather than derived so a fee-schedule change never rewrites what a
 * mosque was actually paid.
 */
export interface Donation {
  _id: ID;
  mosqueId: ID;
  /** Absent for an anonymous or off-platform gift. */
  userId?: ID;
  /** Set when the donation came from a specific event or class. */
  postId?: ID;
  donorName?: string;
  donorEmail?: string;
  amountCents: number;
  feeCents: number;
  netCents: number;
  currency: Currency;
  status: DonationStatus;
  method: PaymentMethod;
  reference?: string;
  /** Whether the mosque has been paid out its `netCents`. */
  payoutAt?: Timestamp;
  createdAt: Timestamp;
  note?: string;
}

export interface CreateDonationInput {
  mosqueId: ID;
  userId?: ID;
  postId?: ID;
  donorName?: string;
  donorEmail?: string;
  amountCents: number;
  /** Omit to apply `PLATFORM_FEE_BPS`. */
  feeCents?: number;
  status?: DonationStatus;
  method?: PaymentMethod;
  reference?: string;
  note?: string;
}

/** Our cut of a passthrough donation, in basis points. 250 = 2.5%. */
export const PLATFORM_FEE_BPS = 250;

export function platformFeeCents(amountCents: number): number {
  return Math.round((amountCents * PLATFORM_FEE_BPS) / 10_000);
}

// ─── Partner advertisers & campaigns ────────────────────────────────────────

export type AdvertiserStatus = 'active' | 'paused' | 'archived';

/**
 * A partner buying placement in the app — the halal restaurant down the street,
 * a modest-wear brand, a driving school. Not a mosque: a mosque's own posts go
 * in the feed for free, and conflating the two would let an advertiser inherit
 * a mosque's trust.
 */
export interface Advertiser {
  _id: ID;
  name: string;
  /** "Restaurant", "Retail", "Education", … — free text, used for filtering. */
  category: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  /** Server-relative, minted by the upload endpoint like every other image. */
  logoUrl?: string;
  status: AdvertiserStatus;
  note?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAdvertiserInput {
  name: string;
  category: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  logoUrl?: string;
  status?: AdvertiserStatus;
  note?: string;
}

export type UpdateAdvertiserInput = Partial<CreateAdvertiserInput>;

/**
 * `draft` → `pending` → `active` ⇄ `paused` → `completed`, with `rejected` as
 * the terminal branch off review. The server, not the client, decides which
 * transitions are legal — see `CAMPAIGN_TRANSITIONS`.
 */
export type CampaignStatus = 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'rejected';

/** What a campaign is charged on. */
export type PricingModel = 'flat' | 'cpm' | 'cpc';

/** Where the creative may appear. */
export type AdPlacement = 'feed' | 'mosque-profile' | 'post-detail';

export const AD_PLACEMENTS: readonly AdPlacement[] = ['feed', 'mosque-profile', 'post-detail'];

/**
 * The advert itself. Deliberately small — one image, a headline, a line of
 * body, one call to action. The feed is a mosque's noticeboard; a partner card
 * that outweighs the posts around it is a product mistake, not a revenue win.
 */
export interface CampaignCreative {
  headline: string;
  body: string;
  /** Server-relative, minted by the upload endpoint. */
  imageUrl?: string;
  ctaLabel: string;
  /** Absolute, and shown to the user — this one leaves our domain by design. */
  ctaUrl: string;
  /** Rendered on the card so nobody mistakes it for a mosque's own post. */
  disclosure?: string;
}

/**
 * Who sees it. Every field is a narrowing filter; an empty array means "no
 * restriction on this axis", which is why the delivery query treats an empty
 * list and an absent one identically.
 */
export interface CampaignTargeting {
  cities: string[];
  mosqueIds: ID[];
  /** Matched against `User.interests`. */
  interests: string[];
  placements: AdPlacement[];
}

export interface Campaign {
  _id: ID;
  advertiserId: ID;
  name: string;
  status: CampaignStatus;
  creative: CampaignCreative;
  targeting: CampaignTargeting;
  startAt: Timestamp;
  endAt: Timestamp;
  /** The whole flight's budget, in cents. */
  budgetCents: number;
  pricing: PricingModel;
  /** Per thousand impressions (`cpm`) or per click (`cpc`); ignored for `flat`. */
  rateCents: number;
  currency: Currency;
  /** Denormalised lifetime counters — the per-day rows are the audit trail. */
  impressions: number;
  clicks: number;
  /** What has been consumed of `budgetCents`, from the pricing model. */
  spentCents: number;
  /** Set when a super admin approved it out of `pending`. */
  approvedBy?: ID;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  createdBy: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** The legal moves. Anything not listed here is a 400, not a silent no-op. */
export const CAMPAIGN_TRANSITIONS: Readonly<Record<CampaignStatus, readonly CampaignStatus[]>> = {
  draft: ['pending', 'active', 'rejected'],
  pending: ['active', 'rejected', 'draft'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
  rejected: ['draft'],
};

export interface CreateCampaignInput {
  advertiserId: ID;
  name: string;
  creative: CampaignCreative;
  targeting?: Partial<CampaignTargeting>;
  startAt: Timestamp;
  endAt: Timestamp;
  budgetCents: number;
  pricing?: PricingModel;
  rateCents?: number;
}

export type UpdateCampaignInput = Partial<Omit<CreateCampaignInput, 'advertiserId'>>;

/** One campaign's activity on one day. The rollup the charts read. */
export interface CampaignStat {
  campaignId: ID;
  date: DateString;
  impressions: number;
  clicks: number;
  spentCents: number;
}

/** A campaign with its advertiser resolved, for the dashboard's table. */
export interface CampaignWithAdvertiser extends Campaign {
  advertiserName: string;
  /** `clicks / impressions` as 0–100, one decimal. */
  ctr: number;
  /** Daily rollup over the flight, oldest first. Detail view only. */
  daily?: CampaignStat[];
}

/**
 * What the *mobile app* gets — the creative and nothing else. No budget, no
 * rate, no targeting: those are commercial facts about a deal the reader is not
 * party to, and they have no business on a phone.
 */
export interface ServedAd {
  campaignId: ID;
  advertiserName: string;
  placement: AdPlacement;
  headline: string;
  body: string;
  imageUrl?: string;
  ctaLabel: string;
  ctaUrl: string;
  disclosure: string;
}

// ─── Support ────────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory =
  'account' | 'billing' | 'bug' | 'mosque' | 'content' | 'feature' | 'other';

export interface TicketMessage {
  _id: ID;
  authorId: ID;
  authorName: string;
  /** True when it came from the platform side rather than the reporter. */
  fromStaff: boolean;
  body: string;
  /** Not shown to the reporter — the working notes on the case. */
  internal: boolean;
  createdAt: Timestamp;
}

/**
 * One user problem, start to finish.
 *
 * The thread is embedded rather than a second collection: a ticket is read
 * whole every time it is read at all, and the messages are bounded by the fact
 * that a human is typing them.
 */
export interface SupportTicket {
  _id: ID;
  /** Sequential and short, because it gets read aloud on a phone call. */
  reference: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  /** Who reported it. Absent for something we opened ourselves. */
  userId?: ID;
  userName?: string;
  userEmail?: string;
  mosqueId?: ID;
  /** The platform user handling it. */
  assignedTo?: ID;
  assignedToName?: string;
  messages: TicketMessage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  resolvedAt?: Timestamp;
  /** Hours from creation to resolution, for the support stats. */
  resolutionHours?: number;
}

export interface CreateTicketInput {
  subject: string;
  body: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  userId?: ID;
  mosqueId?: ID;
}

export type UpdateTicketInput = Partial<
  Pick<SupportTicket, 'status' | 'priority' | 'category' | 'assignedTo' | 'subject'>
>;

export interface AddTicketMessageInput {
  body: string;
  /** Default false — a reply the reporter will see. */
  internal?: boolean;
}

// ─── Audit ──────────────────────────────────────────────────────────────────

export type AuditTargetType =
  | 'mosque'
  | 'user'
  | 'invoice'
  | 'subscription'
  | 'campaign'
  | 'advertiser'
  | 'ticket'
  | 'donation'
  | 'post';

/**
 * Every write a platform operator makes, appended and never updated.
 *
 * This exists because the super admin can change anything: issue credentials,
 * void an invoice, suspend an account. An action that powerful with no record
 * of who took it is one the team cannot investigate later.
 */
export interface AuditEntry {
  _id: ID;
  actorId: ID;
  actorName: string;
  /** Dotted and past tense: `mosque.created`, `invoice.voided`. */
  action: string;
  targetType: AuditTargetType;
  targetId: ID;
  /**
   * A short human sentence, written at the call site — the log is read by
   * people, and reconstructing prose from a diff is worse than storing it.
   */
  summary: string;
  /** Whatever the action needs to be understood later. Never secrets. */
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: Timestamp;
}

// ─── Query & list shapes ────────────────────────────────────────────────────

/** Cursorless paging: the tables are sortable and jump-to-page, not infinite. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
  /** Free text, matched against whatever the endpoint says it searches. */
  q?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  /** `Math.ceil(total / pageSize)`, at least 1 so the pager never renders 0. */
  pages: number;
}

/** The mosque detail screen — everything about one mosque on one page. */
export interface MosqueDetail {
  mosque: Mosque & { city?: string; timezone?: string };
  summary: MosqueSummary;
  subscription: Subscription | null;
  coordinators: { userId: ID; name: string; email: string; joinedAt: Timestamp }[];
  invoices: Invoice[];
  donations: Donation[];
  recentPosts: {
    _id: ID;
    title: string;
    type: PostType;
    startAt: Timestamp;
    cancelledAt?: Timestamp;
    signupCount: number;
  }[];
  daily: DailyPoint[];
}

/** What the super admin sends to create an event on a mosque's behalf. */
export interface AdminCreateEventInput {
  mosqueId: ID;
  type: PostType;
  title: string;
  description: string;
  category: string;
  startAt: Timestamp;
  endAt: Timestamp;
  location: string;
  slotsNeeded?: number;
  capacity?: number;
  imageUrl?: string;
  /** Push it to the mosque's followers, as the mosque. Default true. */
  notify?: boolean;
}

/** Revenue over time, for the billing screen's chart. */
export interface RevenuePoint {
  /** `YYYY-MM`. */
  month: string;
  subscriptionCents: number;
  campaignCents: number;
  donationFeeCents: number;
  totalCents: number;
}

export interface BillingSummary {
  mrrCents: number;
  arrCents: number;
  outstandingCents: number;
  overdueCents: number;
  collected30dCents: number;
  donationVolume30dCents: number;
  donationFees30dCents: number;
  byPlan: { plan: PlanId; mosques: number; mrrCents: number }[];
  revenue: RevenuePoint[];
}

// ─── Formatting helpers, shared by the dashboard and any receipt ────────────

/** `1234567` → `"$12,345.67"`. One implementation, so totals never disagree. */
export function formatMoney(cents: number, currency: Currency = DEFAULT_CURRENCY): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toLocaleString('en-CA');
  const frac = String(abs % 100).padStart(2, '0');
  const symbol = currency === 'USD' ? 'US$' : '$';
  return `${sign}${symbol}${whole}.${frac}`;
}

/** What a plan costs over one billing period. Yearly is ten months' price. */
export function planPriceCents(plan: PlanId, interval: BillingInterval = 'monthly'): number {
  const monthly = planById(plan).priceCents;
  return interval === 'yearly' ? monthly * 10 : monthly;
}

/** A subscription's contribution to MRR, whatever interval it bills on. */
export function monthlyValueCents(
  sub: Pick<Subscription, 'priceCents' | 'interval' | 'status'>,
): number {
  if (sub.status !== 'active' && sub.status !== 'trialing') return 0;
  return sub.interval === 'yearly' ? Math.round(sub.priceCents / 12) : sub.priceCents;
}

/** What a campaign has consumed, from its pricing model. */
export function campaignSpentCents(
  campaign: Pick<Campaign, 'pricing' | 'rateCents' | 'budgetCents' | 'impressions' | 'clicks'>,
): number {
  const raw =
    campaign.pricing === 'cpm'
      ? Math.round((campaign.impressions / 1000) * campaign.rateCents)
      : campaign.pricing === 'cpc'
        ? campaign.clicks * campaign.rateCents
        : campaign.budgetCents;
  // A flight can never spend past what was sold, however the counters move.
  return Math.min(raw, campaign.budgetCents);
}
