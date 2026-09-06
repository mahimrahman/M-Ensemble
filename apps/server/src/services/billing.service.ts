import type { Request } from 'express';
import type {
  BillingSummary,
  CreateDonationInput,
  CreateInvoiceInput,
  CreateSubscriptionInput,
  Donation,
  DonationStatus,
  Invoice,
  InvoiceKind,
  InvoiceStatus,
  PageQuery,
  PageResult,
  Payment,
  RecordPaymentInput,
  RevenuePoint,
  Subscription,
  UpdateSubscriptionInput,
} from '@m-ensemble/shared';
import { DonationModel } from '../models/Donation.js';
import { InvoiceModel, type InvoiceDocument } from '../models/Invoice.js';
import { PaymentModel } from '../models/Payment.js';
import { SubscriptionModel } from '../models/Subscription.js';
import { MosqueModel } from '../models/Mosque.js';
import { AdvertiserModel } from '../models/Advertiser.js';
import { nextSequence } from '../models/Counter.js';
import type { UserDocument } from '../models/User.js';
import { monthlyValueCents, platformFeeCents, standardPriceCents } from '../shared.js';
import * as audit from './audit.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
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
 * **Nothing here charges anybody.** No processor is connected: invoices are
 * issued, payments are recorded by hand, and a status moves because a super
 * admin moved it. That is a deliberate first pass — the shapes are the ones a
 * processor would write into, so connecting one later is new code at the edges
 * rather than a migration through the middle.
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
      $setOnInsert: { _id: newId(), currency: 'CAD', startedAt: now, createdAt: now },
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
  const invoice = await InvoiceModel.create({
    _id: newId(),
    number: await mintInvoiceNumber(),
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
    dueCents: totalCents,
    issuedAt: now,
    dueAt: new Date(now.getTime() + (input.dueInDays ?? 30) * DAY_MS),
    note: input.note,
    createdBy: actor._id,
    createdAt: now,
    updatedAt: now,
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
