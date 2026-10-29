import type { Request } from 'express';
import type Stripe from 'stripe';
import type {
  BillingSummary,
  CheckoutLink,
  CreateDonationCheckoutInput,
  CreateDonationInput,
  CreateInvoiceInput,
  CreateSubscriptionInput,
  Donation,
  DonationStatus,
  Invoice,
  InvoiceKind,
  InvoiceLine,
  InvoiceStatus,
  PageQuery,
  PageResult,
  Payment,
  PayoutAccountStatus,
  RecordPaymentInput,
  RevenuePoint,
  Subscription,
  SubscriptionStatus,
  UpdateSubscriptionInput,
} from '@m-ensemble/shared';
import { DonationModel, type DonationDocument } from '../models/Donation.js';
import { InvoiceModel, type InvoiceDocument } from '../models/Invoice.js';
import { PaymentModel } from '../models/Payment.js';
import { SubscriptionModel, type SubscriptionDocument } from '../models/Subscription.js';
import { MosqueModel, type MosqueDocument } from '../models/Mosque.js';
import { MembershipModel } from '../models/Membership.js';
import { PostModel } from '../models/Post.js';
import { UserModel, type UserDocument } from '../models/User.js';
import { AdvertiserModel } from '../models/Advertiser.js';
import { StripeEventModel } from '../models/StripeEvent.js';
import { nextSequence } from '../models/Counter.js';
import { formatMoney, monthlyValueCents, platformFeeCents, standardPriceCents } from '../shared.js';
import * as audit from './audit.service.js';
import { apiUrl, renderEmail, sendEmail, webUrl } from './email.service.js';
import { requireStripe } from './stripe.service.js';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR, isDuplicateKey } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { logger } from '../utils/logger.js';
import { asContract } from '../utils/serialize.js';
import { DAY_MS } from '../utils/time.js';
import { pageResult, resolvePage, searchRegex, sortSpec } from '../utils/paging.js';

/**
 * The money. All three flows the platform models:
 *
 *   - **Subscriptions** — a mosque pays us monthly. There are no tiers: every
 *     mosque gets the whole product, and what varies is only what each one was
 *     agreed at, with the reason in `note`.
 *   - **Campaigns** — a partner pays us for placement (invoiced from here,
 *     with the campaign itself in `campaign.service`).
 *   - **Donations** — a member gives to a mosque through us, and we keep a fee.
 *
 * Two ways money moves. The **manual** path is the original one: invoices are
 * issued, payments recorded by hand, and a status moves because a super admin
 * moved it. The **Stripe** path, further down, hands back a Checkout URL and
 * lets the webhook write the same rows — `Invoice`, `Payment`, `Donation` —
 * so every report above them reads both the same way. Nothing in the manual
 * path knows Stripe exists.
 */

// ─── Subscriptions ──────────────────────────────────────────────────────────

export async function listSubscriptions(): Promise<Subscription[]> {
  const rows = await SubscriptionModel.find({}).sort({ updatedAt: -1 });
  return rows.map((r) => asContract<Subscription>(r));
}

export async function upsertSubscription(
  input: CreateSubscriptionInput,
  actor: UserDocument,
  req?: Request,
): Promise<Subscription> {
  const mosque = await MosqueModel.findById(input.mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');

  const now = new Date();
  const interval = input.interval ?? 'monthly';
  const priceCents = input.priceCents ?? standardPriceCents(interval);
  const periodEnd = new Date(now);
  if (interval === 'yearly') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const trialEndsAt = input.trialDays
    ? new Date(now.getTime() + input.trialDays * DAY_MS)
    : undefined;

  // One row per mosque — the unique index says so. What they used to be
  // charged is readable from the invoices, which is where anyone asking that is
  // actually looking.
  const existing = await SubscriptionModel.findOne({ mosqueId: input.mosqueId });
  const previousPrice = existing?.priceCents;

  const doc = await SubscriptionModel.findOneAndUpdate(
    { mosqueId: input.mosqueId },
    {
      $set: {
        status: input.status ?? (trialEndsAt ? 'trialing' : 'active'),
        interval,
        priceCents,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt,
        note: input.note,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: newId(),
        currency: 'CAD',
        collectionMethod: 'manual',
        startedAt: now,
        createdAt: now,
      },
    },
    { new: true, upsert: true },
  );

  await audit.record(
    actor,
    {
      action: previousPrice === undefined ? 'subscription.created' : 'subscription.changed',
      targetType: 'subscription',
      targetId: doc._id,
      summary:
        previousPrice === undefined
          ? `${mosque.name} billed at ${(priceCents / 100).toFixed(2)} CAD/${interval === 'yearly' ? 'yr' : 'mo'}`
          : `${mosque.name}: ${(previousPrice / 100).toFixed(2)} → ${(priceCents / 100).toFixed(2)} CAD`,
      meta: { mosqueId: input.mosqueId, previousPrice, priceCents, interval },
    },
    req,
  );

  return asContract<Subscription>(doc);
}

export async function updateSubscription(
  id: string,
  patch: UpdateSubscriptionInput,
  actor: UserDocument,
  req?: Request,
): Promise<Subscription> {
  const sub = await SubscriptionModel.findById(id);
  if (!sub) throw new HttpError(404, ERROR.NOT_FOUND, 'No such subscription.');

  const before = { status: sub.status, priceCents: sub.priceCents };
  if (patch.interval !== undefined) sub.interval = patch.interval;
  if (patch.priceCents !== undefined) sub.priceCents = patch.priceCents;
  if (patch.note !== undefined) sub.note = patch.note;
  if (patch.currentPeriodEnd !== undefined) sub.currentPeriodEnd = new Date(patch.currentPeriodEnd);
  if (patch.collection !== undefined) sub.collectionMethod = patch.collection;
  if (patch.province !== undefined) sub.province = patch.province;
  if (patch.status !== undefined) {
    sub.status = patch.status;
    // Cancelling stamps the date; un-cancelling clears it, so a mosque that
    // came back does not read as still cancelled in every later report.
    sub.cancelledAt = patch.status === 'cancelled' ? new Date() : undefined;
  }
  sub.updatedAt = new Date();
  await sub.save();

  await audit.record(
    actor,
    {
      action: 'subscription.updated',
      targetType: 'subscription',
      targetId: sub._id,
      summary: `Billing for ${sub.mosqueId}: ${before.status} → ${sub.status}, ${(before.priceCents / 100).toFixed(2)} → ${(sub.priceCents / 100).toFixed(2)} CAD`,
      meta: { before, after: { status: sub.status, priceCents: sub.priceCents } },
    },
    req,
  );

  return asContract<Subscription>(sub);
}

// ─── Invoices ───────────────────────────────────────────────────────────────

/**
 * `INV-2026-0042`. Sequential per year through an atomic counter, because two
 * invoices minted in the same millisecond must not share a number and a client
 * cannot guarantee that.
 */
async function mintInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`invoice:${year}`);
  return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

/** Everything an invoice row needs except its number, which is minted here. */
interface InvoiceDraft {
  kind: InvoiceKind;
  mosqueId?: string;
  advertiserId?: string;
  sourceId?: string;
  status: InvoiceStatus;
  currency: string;
  lines: InvoiceLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  issuedAt: Date;
  dueAt: Date;
  paidAt?: Date;
  note?: string;
  createdBy: string;
}

/** The one place an invoice row is written, by hand or by the webhook. */
async function insertInvoice(draft: InvoiceDraft): Promise<InvoiceDocument> {
  const now = new Date();
  return InvoiceModel.create({
    _id: newId(),
    number: await mintInvoiceNumber(),
    ...draft,
    dueCents: Math.max(0, draft.totalCents - draft.paidCents),
    createdAt: now,
    updatedAt: now,
  });
}

const INVOICE_SORTABLE = ['issuedAt', 'dueAt', 'totalCents', 'dueCents', 'number'] as const;

export interface InvoiceQuery extends PageQuery {
  status?: InvoiceStatus;
  kind?: InvoiceKind;
  mosqueId?: string;
  advertiserId?: string;
  /** Open invoices whose due date has passed. */
  overdue?: boolean;
}

export async function listInvoices(query: InvoiceQuery): Promise<PageResult<Invoice>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.kind) filter.kind = query.kind;
  if (query.mosqueId) filter.mosqueId = query.mosqueId;
  if (query.advertiserId) filter.advertiserId = query.advertiserId;
  if (query.overdue) {
    filter.status = 'open';
    filter.dueAt = { $lt: new Date() };
  }

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ number: rx }, { note: rx }];

  const [rows, total] = await Promise.all([
    InvoiceModel.find(filter)
      .sort(sortSpec(query, INVOICE_SORTABLE, { issuedAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    InvoiceModel.countDocuments(filter),
  ]);

  return pageResult(
    rows.map((r) => asContract<Invoice>(r)),
    total,
    resolved,
  );
}

export interface InvoiceWithPayments {
  invoice: Invoice;
  payments: Payment[];
}

export async function getInvoice(id: string): Promise<InvoiceWithPayments> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new HttpError(404, ERROR.NOT_FOUND, 'No such invoice.');
  const payments = await PaymentModel.find({ invoiceId: id }).sort({ receivedAt: -1 });
  return {
    invoice: asContract<Invoice>(invoice),
    payments: payments.map((p) => asContract<Payment>(p)),
  };
}

export async function createInvoice(
  input: CreateInvoiceInput,
  actor: UserDocument,
  req?: Request,
): Promise<Invoice> {
  // Exactly one payer. An invoice against both a mosque and an advertiser has
  // no meaning, and one against neither can never be chased.
  const payers = [input.mosqueId, input.advertiserId].filter(Boolean);
  if (payers.length !== 1) {
    throw new HttpError(
      400,
      ERROR.VALIDATION_ERROR,
      'An invoice needs exactly one of mosqueId or advertiserId.',
    );
  }
  if (input.mosqueId && !(await MosqueModel.exists({ _id: input.mosqueId }))) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');
  }
  if (input.advertiserId && !(await AdvertiserModel.exists({ _id: input.advertiserId }))) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'No such advertiser.');
  }
  if (!input.lines.length) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'An invoice needs at least one line.');
  }

  // Line totals are computed here and stored. A price change next year must
  // never rewrite what somebody was billed last year.
  const lines = input.lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unitCents: l.unitCents,
    amountCents: Math.round(l.quantity * l.unitCents),
  }));
  const subtotalCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  const taxCents = input.taxCents ?? 0;
  const totalCents = subtotalCents + taxCents;

  const now = new Date();
  const invoice = await insertInvoice({
    kind: input.kind,
    mosqueId: input.mosqueId,
    advertiserId: input.advertiserId,
    sourceId: input.sourceId,
    status: input.issue ? 'open' : 'draft',
    currency: input.currency ?? 'CAD',
    lines,
    subtotalCents,
    taxCents,
    totalCents,
    paidCents: 0,
    issuedAt: now,
    dueAt: new Date(now.getTime() + (input.dueInDays ?? 30) * DAY_MS),
    note: input.note,
    createdBy: actor._id,
  });

  await audit.record(
    actor,
    {
      action: input.issue ? 'invoice.issued' : 'invoice.created',
      targetType: 'invoice',
      targetId: invoice._id,
      summary: `${invoice.number} for ${(totalCents / 100).toFixed(2)} CAD`,
      meta: { kind: input.kind, mosqueId: input.mosqueId, advertiserId: input.advertiserId },
    },
    req,
  );

  return asContract<Invoice>(invoice);
}

/** Draft → open. The point at which somebody is actually being asked to pay. */
export async function issueInvoice(
  id: string,
  actor: UserDocument,
  req?: Request,
): Promise<Invoice> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new HttpError(404, ERROR.NOT_FOUND, 'No such invoice.');
  if (invoice.status !== 'draft') {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'Only a draft invoice can be issued.');
  }

  invoice.status = 'open';
  invoice.issuedAt = new Date();
  invoice.updatedAt = new Date();
  await invoice.save();

  await audit.record(
    actor,
    {
      action: 'invoice.issued',
      targetType: 'invoice',
      targetId: invoice._id,
      summary: `Issued ${invoice.number}`,
    },
    req,
  );
  return asContract<Invoice>(invoice);
}

export async function voidInvoice(
  id: string,
  reason: string | undefined,
  actor: UserDocument,
  req?: Request,
): Promise<Invoice> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw new HttpError(404, ERROR.NOT_FOUND, 'No such invoice.');
  if (invoice.status === 'paid') {
    // Voiding something already settled would make the payments on it point at
    // a bill that says it was never owed. Refund it instead.
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'A paid invoice cannot be voided.');
  }

  invoice.status = 'void';
  invoice.voidedAt = new Date();
  invoice.dueCents = 0;
  invoice.updatedAt = new Date();
  if (reason) invoice.note = reason;
  await invoice.save();

  await audit.record(
    actor,
    {
      action: 'invoice.voided',
      targetType: 'invoice',
      targetId: invoice._id,
      summary: `Voided ${invoice.number}${reason ? `: ${reason}` : ''}`,
      meta: { reason },
    },
    req,
  );
  return asContract<Invoice>(invoice);
}

/**
 * Record money that arrived. The **only** writer of `paidCents` and `dueCents`,
 * which is what keeps those two denormalised fields from drifting away from the
 * payments they summarise.
 *
 * A payment that overshoots the total is allowed and leaves `dueCents` at zero
 * — overpayment happens, and refusing to record it would only mean the books
 * disagree with the bank.
 */
export async function recordPayment(
  invoiceId: string,
  input: RecordPaymentInput,
  actor: UserDocument,
  req?: Request,
): Promise<InvoiceWithPayments> {
  const invoice = await InvoiceModel.findById(invoiceId);
  if (!invoice) throw new HttpError(404, ERROR.NOT_FOUND, 'No such invoice.');
  if (invoice.status === 'void') {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'That invoice has been voided.');
  }

  const now = new Date();
  await PaymentModel.create({
    _id: newId(),
    invoiceId,
    amountCents: input.amountCents,
    currency: invoice.currency,
    method: input.method,
    reference: input.reference,
    receivedAt: input.receivedAt ? new Date(input.receivedAt) : now,
    recordedBy: actor._id,
    note: input.note,
    createdAt: now,
  });

  // Re-summed from the rows rather than incremented, so a correcting negative
  // payment lands correctly and a double-submitted form cannot inflate a total
  // that was already right.
  await resyncInvoiceTotals(invoice);

  await audit.record(
    actor,
    {
      action: 'invoice.payment_recorded',
      targetType: 'invoice',
      targetId: invoice._id,
      summary: `Recorded ${(input.amountCents / 100).toFixed(2)} CAD against ${invoice.number} (${input.method})`,
      meta: { amountCents: input.amountCents, method: input.method, reference: input.reference },
    },
    req,
  );

  return getInvoice(invoiceId);
}

async function resyncInvoiceTotals(invoice: InvoiceDocument): Promise<void> {
  const rows = await PaymentModel.aggregate<{ total: number }>([
    { $match: { invoiceId: invoice._id } },
    { $group: { _id: null, total: { $sum: '$amountCents' } } },
  ]);
  const paidCents = rows[0]?.total ?? 0;

  invoice.paidCents = paidCents;
  invoice.dueCents = Math.max(0, invoice.totalCents - paidCents);
  if (paidCents >= invoice.totalCents) {
    invoice.status = 'paid';
    invoice.paidAt = invoice.paidAt ?? new Date();
  } else if (invoice.status === 'paid') {
    // A correction took it back below the total — it is open again, and the
    // paid date has to go with it or the revenue chart keeps counting it.
    invoice.status = 'open';
    invoice.paidAt = undefined;
  }
  invoice.updatedAt = new Date();
  await invoice.save();
}

// ─── Donations ──────────────────────────────────────────────────────────────

const DONATION_SORTABLE = ['createdAt', 'amountCents', 'feeCents'] as const;

export interface DonationQuery extends PageQuery {
  mosqueId?: string;
  status?: DonationStatus;
  /** Settled donations we have not yet paid out to the mosque. */
  unpaidOut?: boolean;
}

export async function listDonations(query: DonationQuery): Promise<PageResult<Donation>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};

  if (query.mosqueId) filter.mosqueId = query.mosqueId;
  if (query.status) filter.status = query.status;
  if (query.unpaidOut) {
    filter.status = 'settled';
    filter.payoutAt = { $exists: false };
  }

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ donorName: rx }, { donorEmail: rx }, { reference: rx }];

  const [rows, total] = await Promise.all([
    DonationModel.find(filter)
      .sort(sortSpec(query, DONATION_SORTABLE, { createdAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    DonationModel.countDocuments(filter),
  ]);

  return pageResult(
    rows.map((r) => asContract<Donation>(r)),
    total,
    resolved,
  );
}

export async function createDonation(
  input: CreateDonationInput,
  actor: UserDocument,
  req?: Request,
): Promise<Donation> {
  if (!(await MosqueModel.exists({ _id: input.mosqueId }))) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');
  }

  // Both the fee and the net are stored, even though either determines the
  // other. A fee schedule that changes next quarter must not retroactively
  // alter what a mosque was owed last quarter.
  const feeCents = input.feeCents ?? platformFeeCents(input.amountCents);
  const donation = await DonationModel.create({
    _id: newId(),
    mosqueId: input.mosqueId,
    userId: input.userId,
    postId: input.postId,
    donorName: input.donorName,
    donorEmail: input.donorEmail,
    amountCents: input.amountCents,
    feeCents,
    netCents: Math.max(0, input.amountCents - feeCents),
    currency: 'CAD',
    status: input.status ?? 'settled',
    method: input.method ?? 'manual',
    reference: input.reference,
    note: input.note,
    createdAt: new Date(),
  });

  await audit.record(
    actor,
    {
      action: 'donation.recorded',
      targetType: 'donation',
      targetId: donation._id,
      summary: `Recorded ${(input.amountCents / 100).toFixed(2)} CAD to ${input.mosqueId}`,
      meta: { mosqueId: input.mosqueId, amountCents: input.amountCents, feeCents },
    },
    req,
  );
  return asContract<Donation>(donation);
}

export async function updateDonation(
  id: string,
  patch: { status?: DonationStatus; markPaidOut?: boolean; note?: string },
  actor: UserDocument,
  req?: Request,
): Promise<Donation> {
  const donation = await DonationModel.findById(id);
  if (!donation) throw new HttpError(404, ERROR.NOT_FOUND, 'No such donation.');

  if (patch.status) donation.status = patch.status;
  if (patch.note !== undefined) donation.note = patch.note;
  if (patch.markPaidOut !== undefined) {
    donation.payoutAt = patch.markPaidOut ? new Date() : undefined;
  }
  await donation.save();

  await audit.record(
    actor,
    {
      action: 'donation.updated',
      targetType: 'donation',
      targetId: donation._id,
      summary: patch.markPaidOut
        ? `Marked ${(donation.netCents / 100).toFixed(2)} CAD paid out to ${donation.mosqueId}`
        : `Donation ${donation._id} set to ${donation.status}`,
    },
    req,
  );
  return asContract<Donation>(donation);
}

// ─── Stripe: shared pieces ──────────────────────────────────────────────────

/**
 * Everything from here down talks to Stripe. The shape is always the same:
 * we build a hosted page and hand back its URL, and the webhook (bottom of the
 * file) writes the rows when Stripe tells us what happened. Nothing is marked
 * paid because a browser came back to a success page — only the webhook moves
 * money state, because only the webhook is signed.
 */

/** `recordedBy` / `createdBy` for rows the webhook writes. Not a user id. */
const STRIPE_ACTOR = 'stripe';

/** The console's origin, for Connect redirects. Falls back to the web site. */
function adminUrl(path: string): string {
  const base = env.PUBLIC_ADMIN_URL ?? webUrl();
  return `${base.replace(/\/$/, '')}${path}`;
}

function unixToDate(seconds: number | null | undefined): Date | undefined {
  return typeof seconds === 'number' ? new Date(seconds * 1000) : undefined;
}

function linkFrom(page: { url: string | null; expires_at?: number | null }): CheckoutLink {
  if (!page.url) throw new HttpError(502, ERROR.INTERNAL_ERROR, 'Stripe returned no URL.');
  return { url: page.url, expiresAt: unixToDate(page.expires_at)?.toISOString() };
}

function stripeId(ref: string | { id: string } | null | undefined): string | undefined {
  if (!ref) return undefined;
  return typeof ref === 'string' ? ref : ref.id;
}

/** The people who run a mosque, first-appointed first. */
async function coordinatorsOf(mosqueId: string): Promise<UserDocument[]> {
  const memberships = await MembershipModel.find({ mosqueId, role: 'admin' }).sort({ createdAt: 1 });
  const order = new Map(memberships.map((m, i) => [m.userId, i]));
  const users = await UserModel.find({ _id: { $in: [...order.keys()] } });
  return users.sort((a, b) => (order.get(a._id) ?? 0) - (order.get(b._id) ?? 0));
}

async function loadSubscription(
  id: string,
): Promise<{ sub: SubscriptionDocument; mosque: MosqueDocument }> {
  const sub = await SubscriptionModel.findById(id);
  if (!sub) throw new HttpError(404, ERROR.NOT_FOUND, 'No such subscription.');
  const mosque = await MosqueModel.findById(sub.mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');
  return { sub, mosque };
}

// ─── Stripe: subscription checkout ──────────────────────────────────────────

/**
 * One Stripe customer per mosque, created the first time a link is made. The
 * email is the first coordinator's — Stripe sends its own receipts there, and
 * it is who the portal link should reach.
 */
async function ensureStripeCustomer(
  sub: SubscriptionDocument,
  mosque: MosqueDocument,
): Promise<string> {
  if (sub.stripeCustomerId) return sub.stripeCustomerId;

  const [first] = await coordinatorsOf(mosque._id);
  const customer = await requireStripe().customers.create({
    name: mosque.name,
    email: first?.email,
    metadata: { mosqueId: mosque._id, subscriptionId: sub._id },
  });

  sub.stripeCustomerId = customer.id;
  sub.updatedAt = new Date();
  await sub.save();
  return customer.id;
}

/**
 * A Checkout page that starts the mosque's Stripe subscription at the agreed
 * price. The price is sent inline (`price_data`) rather than as a catalogue
 * Price: every mosque is on its own number, and keeping a Stripe Price per
 * mosque in sync with `priceCents` would be a second source of truth.
 */
export async function createSubscriptionCheckout(
  id: string,
  actor: UserDocument,
  req?: Request,
): Promise<CheckoutLink> {
  const { sub, mosque } = await loadSubscription(id);
  if (sub.priceCents <= 0) {
    throw new HttpError(400, ERROR.VALIDATION_ERROR, 'This mosque is not billed.');
  }

  const stripe = requireStripe();
  const customer = await ensureStripeCustomer(sub, mosque);

  // Checkout refuses a trial_end less than 48 hours out. A trial about to end
  // simply bills now, which is what the mosque was told would happen anyway.
  const trialEndsAt = sub.trialEndsAt?.getTime();
  const trialEnd =
    trialEndsAt && trialEndsAt > Date.now() + 2 * DAY_MS ? Math.floor(trialEndsAt / 1000) : undefined;

  // Stripe Tax when it is on; our fixed rate ids when it is not. Never both —
  // Stripe rejects a session that specifies tax two ways.
  const taxRateIds = env.STRIPE_AUTOMATIC_TAX
    ? []
    : (env.STRIPE_TAX_RATE_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [
      {
        price_data: {
          currency: 'cad',
          unit_amount: sub.priceCents,
          recurring: { interval: sub.interval === 'yearly' ? 'year' : 'month' },
          product_data: { name: `M'Ensemble — ${mosque.name}` },
        },
        quantity: 1,
        ...(taxRateIds.length ? { tax_rates: taxRateIds } : {}),
      },
    ],
    automatic_tax: { enabled: env.STRIPE_AUTOMATIC_TAX },
    ...(env.STRIPE_AUTOMATIC_TAX ? { customer_update: { address: 'auto' } } : {}),
    subscription_data: {
      metadata: { mosqueId: mosque._id, subscriptionId: sub._id },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    success_url: webUrl('/billing/success?session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: webUrl('/billing/cancelled'),
    metadata: { kind: 'subscription', mosqueId: mosque._id, subscriptionId: sub._id },
  });

  await audit.record(
    actor,
    {
      action: 'subscription.checkout_link',
      targetType: 'subscription',
      targetId: sub._id,
      summary: `Checkout link for ${mosque.name} at ${formatMoney(sub.priceCents)}/${sub.interval === 'yearly' ? 'yr' : 'mo'}`,
      meta: { mosqueId: mosque._id, sessionId: session.id, customer },
    },
    req,
  );

  return linkFrom(session);
}

/** Stripe's customer portal — card on file, invoices, cancel. */
export async function createSubscriptionPortal(
  id: string,
  actor: UserDocument,
  req?: Request,
): Promise<CheckoutLink> {
  const { sub, mosque } = await loadSubscription(id);
  if (!sub.stripeCustomerId) {
    throw new HttpError(
      409,
      ERROR.CONFLICT,
      'This mosque has no Stripe customer yet — send a checkout link first.',
    );
  }

  const session = await requireStripe().billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: webUrl('/billing'),
  });

  await audit.record(
    actor,
    {
      action: 'subscription.portal_link',
      targetType: 'subscription',
      targetId: sub._id,
      summary: `Portal link for ${mosque.name}`,
      meta: { mosqueId: mosque._id },
    },
    req,
  );

  return linkFrom(session);
}

/** Makes the link and mails it to every coordinator of the mosque. */
export async function sendSubscriptionCheckout(
  id: string,
  actor: UserDocument,
  req?: Request,
): Promise<{ sent: number; url: string }> {
  const link = await createSubscriptionCheckout(id, actor, req);
  const { sub, mosque } = await loadSubscription(id);
  const coordinators = await coordinatorsOf(mosque._id);

  const price = `${formatMoney(sub.priceCents)} CAD / ${sub.interval === 'yearly' ? 'an' : 'mois'}`;
  const priceEn = `${formatMoney(sub.priceCents)} CAD / ${sub.interval === 'yearly' ? 'year' : 'month'}`;
  const body = renderEmail(
    `${mosque.name} — abonnement M’Ensemble / M’Ensemble subscription`,
    [
      `Bonjour,`,
      `Voici le lien pour activer l’abonnement M’Ensemble de ${mosque.name} (${price}, taxes en sus). Le paiement se fait sur la page sécurisée de Stripe; nous ne voyons jamais votre carte.`,
      { button: 'Activer l’abonnement', url: link.url },
      `— English —`,
      `Here is the link to start ${mosque.name}’s M’Ensemble subscription (${priceEn}, plus tax). Payment happens on Stripe’s secure page; we never see your card.`,
      { button: 'Start the subscription', url: link.url },
      `Le lien expire après 24 heures. / The link expires after 24 hours.`,
    ],
    'fr',
  );

  let sent = 0;
  for (const user of coordinators) {
    const ok = await sendEmail({
      to: user.email,
      subject: `${mosque.name} — abonnement M’Ensemble / subscription link`,
      ...body,
    });
    if (ok) sent += 1;
  }

  await audit.record(
    actor,
    {
      action: 'subscription.checkout_sent',
      targetType: 'subscription',
      targetId: sub._id,
      summary: `Emailed checkout link for ${mosque.name} to ${sent} coordinator${sent === 1 ? '' : 's'}`,
      meta: { mosqueId: mosque._id, recipients: coordinators.map((u) => u.email) },
    },
    req,
  );

  return { sent, url: link.url };
}

// ─── Stripe Connect: mosque payouts ─────────────────────────────────────────

/** What the console shows about a mosque's payout account. */
export function payoutStatus(mosque: MosqueDocument): PayoutAccountStatus | null {
  if (!mosque.stripeAccountId) return null;
  const p = mosque.payouts;
  return {
    stripeAccountId: mosque.stripeAccountId,
    chargesEnabled: p?.chargesEnabled ?? false,
    payoutsEnabled: p?.payoutsEnabled ?? false,
    detailsSubmitted: p?.detailsSubmitted ?? false,
    requirementsDue: p?.requirementsDue ?? [],
    updatedAt: (p?.updatedAt ?? new Date()).toISOString(),
  };
}

/** Copies the account's capability flags onto the mosque. Caller saves. */
function applyAccountStatus(mosque: MosqueDocument, account: Stripe.Account): void {
  mosque.payouts = {
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsDue: account.requirements?.currently_due ?? [],
    updatedAt: new Date(),
  };
}

/**
 * Start (or resume) a mosque's Connect onboarding.
 *
 * An Express account: Stripe hosts the identity and bank forms and carries the
 * compliance, which is the right trade for a platform this size. The account is
 * created once; the onboarding link is minted fresh every call because Stripe
 * expires them in minutes.
 */
export async function onboardPayouts(
  mosqueId: string,
  actor: UserDocument,
  req?: Request,
): Promise<CheckoutLink> {
  const mosque = await MosqueModel.findById(mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');
  const stripe = requireStripe();

  if (!mosque.stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: env.STRIPE_CONNECT_COUNTRY,
      business_type: 'non_profit',
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_profile: {
        name: mosque.name,
        ...(mosque.website ? { url: `https://${mosque.website}` } : {}),
      },
      metadata: { mosqueId: mosque._id },
    });
    mosque.stripeAccountId = account.id;
    applyAccountStatus(mosque, account);
    await mosque.save();

    await audit.record(
      actor,
      {
        action: 'mosque.payout_account_created',
        targetType: 'mosque',
        targetId: mosque._id,
        summary: `Created Stripe Connect account for ${mosque.name}`,
        meta: { stripeAccountId: account.id },
      },
      req,
    );
  }

  const link = await stripe.accountLinks.create({
    account: mosque.stripeAccountId,
    type: 'account_onboarding',
    refresh_url: adminUrl(`/mosques/${mosque._id}?payouts=refresh`),
    return_url: adminUrl(`/mosques/${mosque._id}?payouts=return`),
  });

  await audit.record(
    actor,
    {
      action: 'mosque.payout_onboarding_link',
      targetType: 'mosque',
      targetId: mosque._id,
      summary: `Onboarding link for ${mosque.name}`,
      meta: { stripeAccountId: mosque.stripeAccountId },
    },
    req,
  );

  return linkFrom(link);
}

/** Re-read the account from Stripe. For the "did they finish?" button. */
export async function refreshPayouts(mosqueId: string): Promise<PayoutAccountStatus> {
  const mosque = await MosqueModel.findById(mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');
  if (!mosque.stripeAccountId) {
    throw new HttpError(409, ERROR.CONFLICT, 'This mosque has not started payout onboarding.');
  }

  const account = await requireStripe().accounts.retrieve(mosque.stripeAccountId);
  applyAccountStatus(mosque, account);
  await mosque.save();
  return payoutStatus(mosque)!;
}

// ─── Stripe: donation checkout ──────────────────────────────────────────────

/**
 * A member's gift, as a destination charge: the card is charged on the
 * platform, the money is transferred to the mosque's account, and our fee is
 * held back as `application_fee_amount`. We never hold the balance.
 *
 * The `Donation` row is written **before** the session, as `pending`, so a
 * webhook that beats the response (it can) finds something to settle. The
 * success and cancel URLs land on this API, not in the app: Checkout refuses
 * anything but http(s), so a tiny page here hands off to the deep link.
 */
export async function createDonationCheckout(
  mosqueId: string,
  input: CreateDonationCheckoutInput,
  donor: UserDocument,
): Promise<CheckoutLink> {
  const mosque = await MosqueModel.findById(mosqueId);
  if (!mosque) throw new HttpError(404, ERROR.NOT_FOUND, 'No such mosque.');
  if (!mosque.stripeAccountId || !mosque.payouts?.chargesEnabled) {
    throw new HttpError(409, 'DONATIONS_DISABLED', 'This mosque is not accepting donations yet.');
  }
  if (input.postId && !(await PostModel.exists({ _id: input.postId, mosqueId }))) {
    throw new HttpError(404, ERROR.NOT_FOUND, 'That post is not at this mosque.');
  }

  const stripe = requireStripe();
  const feeCents = platformFeeCents(input.amountCents);
  const message = input.message?.trim() || undefined;

  const donation = await DonationModel.create({
    _id: newId(),
    mosqueId,
    userId: donor._id,
    postId: input.postId,
    donorName: donor.name,
    donorEmail: donor.email,
    amountCents: input.amountCents,
    feeCents,
    netCents: Math.max(0, input.amountCents - feeCents),
    currency: 'CAD',
    status: 'pending',
    method: 'card',
    message,
    createdAt: new Date(),
  });

  // A deep link can be accepted from the app but not given to Stripe, so a
  // non-http URL falls through to the API's return page, which opens the app.
  const isWeb = (u?: string): u is string => Boolean(u && /^https?:\/\//i.test(u));
  const successUrl = isWeb(input.successUrl)
    ? input.successUrl
    : apiUrl('/donations/return?status=success&session_id={CHECKOUT_SESSION_ID}');
  const cancelUrl = isWeb(input.cancelUrl)
    ? input.cancelUrl
    : apiUrl('/donations/return?status=cancelled&session_id={CHECKOUT_SESSION_ID}');

  const metadata: Record<string, string> = {
    kind: 'donation',
    donationId: donation._id,
    mosqueId,
    userId: donor._id,
    ...(input.postId ? { postId: input.postId } : {}),
    ...(message ? { message } : {}),
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: donor.email,
      line_items: [
        {
          price_data: {
            currency: 'cad',
            unit_amount: input.amountCents,
            product_data: { name: `Donation — ${mosque.name}` },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: feeCents,
        transfer_data: { destination: mosque.stripeAccountId },
        metadata,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
  } catch (err) {
    // The row exists and nothing was charged — say so rather than leave a
    // `pending` that looks like a donor still on Stripe's page.
    donation.status = 'failed';
    donation.note = 'Checkout session could not be created.';
    await donation.save();
    throw err;
  }

  donation.stripeCheckoutSessionId = session.id;
  await donation.save();

  return linkFrom(session);
}

// ─── Stripe: webhook ────────────────────────────────────────────────────────

/**
 * Process one verified event. Returns `duplicate` when Stripe has already
 * delivered it, in which case nothing runs — `StripeEvent._id` is the event
 * id, and the insert is the lock.
 *
 * A handler that throws is **logged and recorded, not surfaced**: the route
 * answers 200 either way. Stripe retries a non-2xx for three days, and an
 * event that fails deterministically (a subscription we cannot find) would be
 * retried forty times to the same end. The `error` on the row is the signal.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<'processed' | 'duplicate'> {
  try {
    await StripeEventModel.create({ _id: event.id, type: event.type, receivedAt: new Date() });
  } catch (err) {
    if (isDuplicateKey(err)) return 'duplicate';
    throw err;
  }

  try {
    await dispatchStripeEvent(event);
    await StripeEventModel.updateOne({ _id: event.id }, { $set: { processedAt: new Date() } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, eventId: event.id, type: event.type }, '[stripe] webhook handler failed');
    await StripeEventModel.updateOne({ _id: event.id }, { $set: { error: message } });
  }
  return 'processed';
}

async function dispatchStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      return onCheckoutCompleted(event.data.object);
    case 'checkout.session.expired':
      return onCheckoutExpired(event.data.object);
    case 'invoice.paid':
      return onInvoicePaid(event.data.object);
    case 'invoice.payment_failed':
      return onInvoicePaymentFailed(event.data.object);
    case 'customer.subscription.updated':
      return onSubscriptionUpdated(event.data.object);
    case 'customer.subscription.deleted':
      return onSubscriptionDeleted(event.data.object);
    case 'account.updated':
      return onAccountUpdated(event.data.object);
    case 'charge.refunded':
      return onChargeRefunded(event.data.object);
    default:
      logger.debug({ type: event.type }, '[stripe] event ignored');
  }
}

/** Stripe's subscription statuses, in our four words. Null means "no change". */
function mapSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus | null {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    default:
      // `incomplete` and `paused` are transitional; the row keeps saying what
      // it said until Stripe settles on something.
      return null;
  }
}

/** Current period off the first item — where the API keeps it now. */
function periodOf(sub: Stripe.Subscription): { start?: Date; end?: Date } {
  const item = sub.items?.data?.[0];
  return { start: unixToDate(item?.current_period_start), end: unixToDate(item?.current_period_end) };
}

/**
 * Our row for a Stripe subscription. Tried three ways because the first
 * event after Checkout arrives before `externalRef` is set: by the Stripe
 * subscription id, by the id we put in its metadata, then by customer.
 */
async function findSubscription(
  stripeSubscriptionId: string | undefined,
  metadata: Stripe.Metadata | null | undefined,
  customerId: string | undefined,
): Promise<SubscriptionDocument | null> {
  if (stripeSubscriptionId) {
    const byRef = await SubscriptionModel.findOne({ externalRef: stripeSubscriptionId });
    if (byRef) return byRef;
  }
  if (metadata?.subscriptionId) {
    const byId = await SubscriptionModel.findById(metadata.subscriptionId);
    if (byId) return byId;
  }
  if (customerId) {
    return SubscriptionModel.findOne({ stripeCustomerId: customerId });
  }
  return null;
}

function applyStripeSubscription(sub: SubscriptionDocument, stripeSub: Stripe.Subscription): void {
  const status = mapSubscriptionStatus(stripeSub.status);
  if (status) {
    sub.status = status;
    sub.cancelledAt =
      status === 'cancelled' ? (unixToDate(stripeSub.canceled_at) ?? new Date()) : undefined;
  }
  const period = periodOf(stripeSub);
  if (period.start) sub.currentPeriodStart = period.start;
  if (period.end) sub.currentPeriodEnd = period.end;
  sub.trialEndsAt = unixToDate(stripeSub.trial_end) ?? sub.trialEndsAt;
  sub.externalRef = stripeSub.id;
  sub.collectionMethod = 'stripe';
  const customer = stripeId(stripeSub.customer);
  if (customer) sub.stripeCustomerId = customer;
  sub.updatedAt = new Date();
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const kind = session.metadata?.kind;

  if (kind === 'subscription') {
    const stripeSubId = stripeId(session.subscription);
    const sub = await findSubscription(stripeSubId, session.metadata, stripeId(session.customer));
    if (!sub) throw new Error(`No subscription for checkout session ${session.id}`);

    if (stripeSubId) {
      // Read it back rather than trust the session: status and period live
      // on the subscription, and the session only carries its id.
      const stripeSub = await requireStripe().subscriptions.retrieve(stripeSubId);
      applyStripeSubscription(sub, stripeSub);
    } else {
      sub.status = 'active';
      sub.collectionMethod = 'stripe';
      sub.updatedAt = new Date();
    }
    const customer = stripeId(session.customer);
    if (customer) sub.stripeCustomerId = customer;
    await sub.save();
    return;
  }

  if (kind === 'donation') {
    const donation =
      (await DonationModel.findOne({ stripeCheckoutSessionId: session.id })) ??
      (session.metadata?.donationId ? await DonationModel.findById(session.metadata.donationId) : null);
    if (!donation) throw new Error(`No donation for checkout session ${session.id}`);

    // Cards settle synchronously, so `paid` is the normal case. A delayed
    // method would arrive as `async_payment_succeeded`, which we do not offer.
    if (session.payment_status !== 'paid') return;
    if (donation.status === 'settled') return;

    donation.status = 'settled';
    donation.stripeCheckoutSessionId = session.id;
    donation.stripePaymentIntentId = stripeId(session.payment_intent);
    donation.reference = donation.stripePaymentIntentId;
    await donation.save();

    const mosque = await MosqueModel.findById(donation.mosqueId);
    const to = donation.donorEmail ?? session.customer_details?.email ?? undefined;
    if (mosque && to) await emailDonationReceipt(donation, mosque, to);
    return;
  }

  logger.warn({ sessionId: session.id, kind }, '[stripe] checkout session of unknown kind');
}

/** Nobody paid. The `pending` row would otherwise sit there forever. */
async function onCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.kind !== 'donation') return;
  await DonationModel.updateOne(
    { stripeCheckoutSessionId: session.id, status: 'pending' },
    { $set: { status: 'failed', note: 'Checkout expired without payment.' } },
  );
}

/**
 * Money arrived for a subscription. Writes the same `Invoice` + `Payment` pair
 * a super admin would have by hand, so the billing screens, the revenue chart
 * and the mosque's own invoice list all see it without special cases.
 */
async function onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const details = invoice.parent?.subscription_details;
  const stripeSubId = stripeId(details?.subscription);
  if (!stripeSubId) {
    logger.debug({ invoiceId: invoice.id }, '[stripe] invoice.paid is not for a subscription');
    return;
  }

  // Retries and `invoice.payment_succeeded` both lead here; one row per Stripe invoice.
  if (await PaymentModel.exists({ reference: invoice.id })) return;

  const customerId = stripeId(invoice.customer);
  const sub = await findSubscription(stripeSubId, details?.metadata, customerId);
  if (!sub) throw new Error(`No subscription for Stripe invoice ${invoice.id} (${stripeSubId})`);

  // The $0 invoice Stripe issues when a trial starts is not revenue and would
  // only be a line of noise in the mosque's history.
  if (invoice.total > 0) {
    const lines: InvoiceLine[] = invoice.lines.data.map((l) => {
      const quantity = l.quantity ?? 1;
      return {
        description: l.description ?? `M'Ensemble — ${sub.interval}`,
        quantity,
        unitCents: quantity > 0 ? Math.round(l.amount / quantity) : l.amount,
        amountCents: l.amount,
      };
    });
    const taxCents = (invoice.total_taxes ?? []).reduce((sum, t) => sum + t.amount, 0);
    const paidAt = unixToDate(invoice.status_transitions?.paid_at) ?? new Date();

    const row = await insertInvoice({
      kind: 'subscription',
      mosqueId: sub.mosqueId,
      sourceId: sub._id,
      status: 'paid',
      currency: invoice.currency.toUpperCase(),
      lines,
      subtotalCents: invoice.subtotal,
      taxCents,
      totalCents: invoice.total,
      paidCents: invoice.amount_paid,
      issuedAt: unixToDate(invoice.created) ?? paidAt,
      dueAt: unixToDate(invoice.due_date) ?? paidAt,
      paidAt,
      note: `Stripe invoice ${invoice.id}`,
      createdBy: STRIPE_ACTOR,
    });

    await PaymentModel.create({
      _id: newId(),
      invoiceId: row._id,
      amountCents: invoice.amount_paid,
      currency: row.currency,
      method: 'card',
      reference: invoice.id,
      receivedAt: paidAt,
      recordedBy: STRIPE_ACTOR,
      createdAt: new Date(),
    });
  }

  const period = invoice.lines.data.find((l) => l.period)?.period;
  sub.status = 'active';
  if (period) {
    sub.currentPeriodStart = new Date(period.start * 1000);
    sub.currentPeriodEnd = new Date(period.end * 1000);
  }
  sub.externalRef = stripeSubId;
  sub.collectionMethod = 'stripe';
  if (customerId) sub.stripeCustomerId = customerId;
  sub.lastStripeInvoiceStatus = 'paid';
  sub.cancelledAt = undefined;
  sub.updatedAt = new Date();
  await sub.save();
}

async function onInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const details = invoice.parent?.subscription_details;
  const stripeSubId = stripeId(details?.subscription);
  if (!stripeSubId) return;

  const sub = await findSubscription(stripeSubId, details?.metadata, stripeId(invoice.customer));
  if (!sub) throw new Error(`No subscription for failed Stripe invoice ${invoice.id}`);

  sub.status = 'past_due';
  sub.lastStripeInvoiceStatus = 'open';
  sub.updatedAt = new Date();
  await sub.save();

  const mosque = await MosqueModel.findById(sub.mosqueId);
  if (mosque) await emailPaymentFailed(mosque, invoice.amount_due);
}

async function onSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
  const sub = await findSubscription(stripeSub.id, stripeSub.metadata, stripeId(stripeSub.customer));
  if (!sub) throw new Error(`No subscription for Stripe subscription ${stripeSub.id}`);
  applyStripeSubscription(sub, stripeSub);
  await sub.save();
}

async function onSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
  const sub = await findSubscription(stripeSub.id, stripeSub.metadata, stripeId(stripeSub.customer));
  if (!sub) throw new Error(`No subscription for Stripe subscription ${stripeSub.id}`);
  sub.status = 'cancelled';
  sub.cancelledAt = unixToDate(stripeSub.canceled_at) ?? new Date();
  sub.updatedAt = new Date();
  await sub.save();
}

async function onAccountUpdated(account: Stripe.Account): Promise<void> {
  const mosque = await MosqueModel.findOne({ stripeAccountId: account.id });
  if (!mosque) {
    // An account we did not create, or one whose mosque was deleted. Not ours
    // to worry about, and not worth a retry.
    logger.warn({ accountId: account.id }, '[stripe] account.updated for unknown account');
    return;
  }
  applyAccountStatus(mosque, account);
  await mosque.save();
}

async function onChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const paymentIntentId = stripeId(charge.payment_intent);
  if (!paymentIntentId) return;
  const donation = await DonationModel.findOne({ stripePaymentIntentId: paymentIntentId });
  if (!donation) return; // a subscription charge — Stripe's own invoice reflects it

  if (charge.refunded) {
    donation.status = 'refunded';
  } else {
    donation.note = `Partially refunded: ${formatMoney(charge.amount_refunded)} CAD`;
  }
  await donation.save();
}

// ─── Stripe: the emails ─────────────────────────────────────────────────────

async function emailDonationReceipt(
  donation: DonationDocument,
  mosque: MosqueDocument,
  to: string,
): Promise<void> {
  const amount = `${formatMoney(donation.amountCents)} CAD`;
  const date = donation.createdAt.toISOString().slice(0, 10);
  const body = renderEmail(
    `Merci pour votre don / Thank you for your donation`,
    [
      `Votre don de ${amount} à ${mosque.name} a été reçu le ${date}. Que Dieu vous récompense.`,
      `Ce courriel confirme le paiement. Le reçu officiel aux fins d’impôt, s’il y a lieu, est délivré par la mosquée elle-même.`,
      `— English —`,
      `Your donation of ${amount} to ${mosque.name} was received on ${date}. May God reward you.`,
      `This email confirms the payment. An official tax receipt, where applicable, is issued by the mosque itself.`,
      ...(donation.message ? [`Votre message / Your message: “${donation.message}”`] : []),
    ],
    'fr',
  );
  await sendEmail({ to, subject: `Reçu — don à ${mosque.name} / Donation receipt`, ...body });
}

async function emailPaymentFailed(mosque: MosqueDocument, amountDueCents: number): Promise<void> {
  const amount = `${formatMoney(amountDueCents)} CAD`;
  const body = renderEmail(
    `${mosque.name} — paiement refusé / payment failed`,
    [
      `Le paiement de ${amount} pour l’abonnement M’Ensemble de ${mosque.name} n’a pas abouti. Stripe réessaiera dans les prochains jours; si la carte a changé, répondez à ce courriel et nous vous enverrons un lien pour la mettre à jour.`,
      `— English —`,
      `The ${amount} payment for ${mosque.name}’s M’Ensemble subscription did not go through. Stripe will retry over the next few days; if the card has changed, reply to this email and we will send a link to update it.`,
    ],
    'fr',
  );
  for (const user of await coordinatorsOf(mosque._id)) {
    await sendEmail({
      to: user.email,
      subject: `${mosque.name} — paiement refusé / payment failed`,
      ...body,
    });
  }
}

// ─── The billing screen's numbers ───────────────────────────────────────────

export async function billingSummary(): Promise<BillingSummary> {
  const now = Date.now();
  const windowStart = new Date(now - 30 * DAY_MS);

  const [subs, outstanding, overdue, collected, donations30d, revenue] = await Promise.all([
    SubscriptionModel.find({}),
    InvoiceModel.aggregate<{ total: number }>([
      { $match: { status: { $in: ['open', 'uncollectible'] } } },
      { $group: { _id: null, total: { $sum: '$dueCents' } } },
    ]),
    InvoiceModel.aggregate<{ total: number }>([
      { $match: { status: 'open', dueAt: { $lt: new Date() } } },
      { $group: { _id: null, total: { $sum: '$dueCents' } } },
    ]),
    InvoiceModel.aggregate<{ total: number }>([
      { $match: { paidAt: { $gte: windowStart } } },
      { $group: { _id: null, total: { $sum: '$paidCents' } } },
    ]),
    DonationModel.aggregate<{ _id: null; gross: number; fees: number }>([
      { $match: { status: 'settled', createdAt: { $gte: windowStart } } },
      { $group: { _id: null, gross: { $sum: '$amountCents' }, fees: { $sum: '$feeCents' } } },
    ]),
    revenueByMonth(12),
  ]);

  // Grouped by where a mosque's billing *stands*, not by what it gets — every
  // mosque gets the same product, so a breakdown by tier would be a chart of
  // one bar.
  const byStatus = (['active', 'trialing', 'past_due', 'cancelled'] as const).map((status) => {
    const rows = subs.filter((s) => s.status === status);
    return {
      status,
      mosques: rows.length,
      mrrCents: rows.reduce((sum, s) => sum + monthlyValueCents(s), 0),
    };
  });
  const mrrCents = byStatus.reduce((sum, row) => sum + row.mrrCents, 0);

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    outstandingCents: outstanding[0]?.total ?? 0,
    overdueCents: overdue[0]?.total ?? 0,
    collected30dCents: collected[0]?.total ?? 0,
    donationVolume30dCents: donations30d[0]?.gross ?? 0,
    donationFees30dCents: donations30d[0]?.fees ?? 0,
    byStatus,
    notBilledCount: subs.filter((s) => s.priceCents === 0).length,
    revenue,
  };
}

/**
 * Revenue by month, split by where it came from.
 *
 * Recognised on the date money **arrived**, not the date it was invoiced — a
 * bill issued in March and paid in May is May's revenue, which is the only
 * version of the number that reconciles against a bank statement.
 */
async function revenueByMonth(months: number): Promise<RevenuePoint[]> {
  const from = new Date();
  from.setMonth(from.getMonth() - (months - 1));
  from.setDate(1);
  from.setHours(0, 0, 0, 0);

  const [invoices, donations] = await Promise.all([
    InvoiceModel.aggregate<{ _id: { month: string; kind: string }; total: number }>([
      { $match: { paidAt: { $gte: from } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$paidAt' } }, kind: '$kind' },
          total: { $sum: '$paidCents' },
        },
      },
    ]),
    DonationModel.aggregate<{ _id: string; fees: number }>([
      { $match: { status: 'settled', createdAt: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          fees: { $sum: '$feeCents' },
        },
      },
    ]),
  ]);

  const feeByMonth = new Map(donations.map((d) => [d._id, d.fees]));
  const invoiceByMonth = new Map<string, Record<string, number>>();
  for (const row of invoices) {
    const bucket = invoiceByMonth.get(row._id.month) ?? {};
    bucket[row._id.kind] = (bucket[row._id.kind] ?? 0) + row.total;
    invoiceByMonth.set(row._id.month, bucket);
  }

  // Every month in the range, including the empty ones — a series that skips
  // a quiet month draws a chart where nothing happened and something did.
  const out: RevenuePoint[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(from);
    d.setMonth(d.getMonth() + i);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = invoiceByMonth.get(month) ?? {};
    const subscriptionCents = bucket.subscription ?? 0;
    const campaignCents = bucket.campaign ?? 0;
    const donationFeeCents = feeByMonth.get(month) ?? 0;
    out.push({
      month,
      subscriptionCents,
      campaignCents,
      donationFeeCents,
      totalCents: subscriptionCents + campaignCents + donationFeeCents + (bucket.other ?? 0),
    });
  }
  return out;
}
