import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, tokenFor, AMINA, YUSUF } from './helpers/api.js';
import { createStripeMock, type StripeMock } from './helpers/stripeMock.js';
import { setStripeClientForTests } from '../src/services/stripe.service.js';
import { sentEmails } from '../src/services/email.service.js';
import { SubscriptionModel } from '../src/models/Subscription.js';
import { MosqueModel } from '../src/models/Mosque.js';
import { DonationModel } from '../src/models/Donation.js';
import { InvoiceModel } from '../src/models/Invoice.js';
import { PaymentModel } from '../src/models/Payment.js';
import { StripeEventModel } from '../src/models/StripeEvent.js';
import { KHADIJA_ID } from '../src/shared.js';
import { env } from '../src/config/env.js';

/**
 * The Stripe edge of billing, against an in-memory fake of the client.
 *
 * What these prove is the server's half of the contract: the rows we write,
 * the gates we enforce and the emails we send. Stripe's half — that a card
 * gets charged — is Stripe's to prove, and the fake stands in for it.
 */

let stripe: StripeMock;

async function superAdminToken(): Promise<string> {
  const res = await api
    .post('/api/auth/login')
    .send({ email: env.SUPERADMIN_EMAIL, password: env.SUPERADMIN_PASSWORD })
    .expect(200);
  return res.body.data.token as string;
}

async function khadijaSubscriptionId(): Promise<string> {
  const sub = await SubscriptionModel.findOne({ mosqueId: KHADIJA_ID });
  if (!sub) throw new Error('seed has no Khadija subscription');
  return sub._id;
}

/** Posts a webhook as Stripe would: raw JSON body, signature header. */
function postWebhook(event: Record<string, unknown>, signature = 'valid') {
  return api
    .post('/webhooks/stripe')
    .set('stripe-signature', signature)
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(event));
}

let eventSeq = 0;
function stripeEvent(type: string, object: Record<string, unknown>, id?: string) {
  return {
    id: id ?? `evt_test_${String(++eventSeq).padStart(4, '0')}`,
    object: 'event',
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  };
}

/** Pretend the mosque has finished Connect onboarding. */
async function enablePayouts(mosqueId: string, accountId = 'acct_test_ready'): Promise<void> {
  await MosqueModel.updateOne(
    { _id: mosqueId },
    {
      $set: {
        stripeAccountId: accountId,
        payouts: {
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
          requirementsDue: [],
          updatedAt: new Date(),
        },
      },
    },
  );
}

beforeAll(() => {
  stripe = createStripeMock();
  setStripeClientForTests(stripe.client);
});

afterAll(() => {
  setStripeClientForTests(null);
});

beforeEach(() => {
  sentEmails.length = 0;
  stripe = createStripeMock();
  setStripeClientForTests(stripe.client);
});

// ─── Subscription checkout ──────────────────────────────────────────────────

describe('subscription checkout', () => {
  it('creates a Stripe customer for the mosque and returns a hosted link', async () => {
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();

    const res = await api
      .post(`/api/admin/billing/subscriptions/${subId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.data.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);
    expect(res.body.data.expiresAt).toBeDefined();

    // One customer, named for the mosque, reaching its first coordinator.
    expect(stripe.calls.customersCreate).toHaveLength(1);
    expect(stripe.calls.customersCreate[0]).toMatchObject({
      name: 'Khadijah Islamic Center',
      email: AMINA,
      metadata: { mosqueId: KHADIJA_ID },
    });

    const sub = await SubscriptionModel.findById(subId);
    expect(sub?.stripeCustomerId).toMatch(/^cus_test_/);

    // The session itself bills the agreed price, monthly, as a subscription.
    const session = stripe.calls.checkoutSessionsCreate[0] as {
      mode: string;
      line_items: { price_data: { unit_amount: number; recurring: { interval: string } } }[];
      metadata: Record<string, string>;
    };
    expect(session.mode).toBe('subscription');
    expect(session.line_items[0]!.price_data.unit_amount).toBe(sub!.priceCents);
    expect(session.line_items[0]!.price_data.recurring.interval).toBe('month');
    expect(session.metadata).toMatchObject({ kind: 'subscription', subscriptionId: subId });
  });

  it('reuses the customer on the second link', async () => {
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();
    for (let i = 0; i < 2; i++) {
      await api
        .post(`/api/admin/billing/subscriptions/${subId}/checkout`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    }
    expect(stripe.calls.customersCreate).toHaveLength(1);
    expect(stripe.calls.checkoutSessionsCreate).toHaveLength(2);
  });

  it('refuses the portal before a customer exists, then opens it', async () => {
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();

    const before = await api
      .post(`/api/admin/billing/subscriptions/${subId}/portal`)
      .set('Authorization', `Bearer ${token}`);
    expect(before.status).toBe(409);

    await api
      .post(`/api/admin/billing/subscriptions/${subId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const after = await api
      .post(`/api/admin/billing/subscriptions/${subId}/portal`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(after.body.data.url).toMatch(/^https:\/\/billing\.stripe\.test\//);
  });

  it('emails the link to the coordinators', async () => {
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();

    const res = await api
      .post(`/api/admin/billing/subscriptions/${subId}/send-checkout`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(res.body.data.sent).toBeGreaterThanOrEqual(1);
    const mail = sentEmails.find((m) => m.to === AMINA);
    expect(mail).toBeDefined();
    expect(mail!.text).toContain(res.body.data.url);
    // Bilingual, French first.
    expect(mail!.text).toMatch(/Activer l’abonnement/);
    expect(mail!.text).toMatch(/Start the subscription/);
  });

  it('is superadmin-only — a coordinator cannot mint a link for her own mosque', async () => {
    const token = await tokenFor(AMINA);
    const subId = await khadijaSubscriptionId();
    const res = await api
      .post(`/api/admin/billing/subscriptions/${subId}/checkout`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('activates the subscription when Checkout completes', async () => {
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();
    await SubscriptionModel.updateOne({ _id: subId }, { $set: { status: 'past_due' } });

    await api
      .post(`/api/admin/billing/subscriptions/${subId}/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const sub = await SubscriptionModel.findById(subId);

    stripe.subscriptions.set('sub_test_001', {
      id: 'sub_test_001',
      object: 'subscription',
      status: 'active',
      customer: sub!.stripeCustomerId,
      canceled_at: null,
      trial_end: null,
      metadata: { mosqueId: KHADIJA_ID, subscriptionId: subId },
      items: { data: [{ current_period_start: 1_800_000_000, current_period_end: 1_802_592_000 }] },
    });

    await postWebhook(
      stripeEvent('checkout.session.completed', {
        id: 'cs_test_sub',
        object: 'checkout.session',
        mode: 'subscription',
        customer: sub!.stripeCustomerId,
        subscription: 'sub_test_001',
        payment_status: 'paid',
        metadata: { kind: 'subscription', mosqueId: KHADIJA_ID, subscriptionId: subId },
      }),
    ).expect(200);

    const after = await SubscriptionModel.findById(subId);
    expect(after?.status).toBe('active');
    expect(after?.externalRef).toBe('sub_test_001');
    expect(after?.collectionMethod).toBe('stripe');
    expect(after?.currentPeriodEnd.getTime()).toBe(1_802_592_000 * 1000);

    // The contract spells it `collection`.
    const list = await api
      .get('/api/admin/billing/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const row = list.body.data.find((s: { _id: string }) => s._id === subId);
    expect(row.collection).toBe('stripe');
    expect(row.collectionMethod).toBeUndefined();
  });
});

// ─── Donation checkout ──────────────────────────────────────────────────────

describe('donation checkout', () => {
  it('is refused while the mosque has no payout account', async () => {
    const token = await tokenFor(YUSUF);
    const res = await api
      .post(`/api/mosques/${KHADIJA_ID}/donations/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 2500 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DONATIONS_DISABLED');
    expect(await DonationModel.countDocuments({ method: 'card' })).toBe(0);
  });

  it('creates a pending card donation and a destination-charge session once enabled', async () => {
    await enablePayouts(KHADIJA_ID);
    const token = await tokenFor(YUSUF);

    const res = await api
      .post(`/api/mosques/${KHADIJA_ID}/donations/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 2500, message: 'For the Saturday class' })
      .expect(201);
    expect(res.body.data.url).toMatch(/^https:\/\/checkout\.stripe\.test\//);

    const donation = await DonationModel.findOne({ mosqueId: KHADIJA_ID, method: 'card' });
    expect(donation).not.toBeNull();
    expect(donation!.status).toBe('pending');
    expect(donation!.amountCents).toBe(2500);
    expect(donation!.feeCents).toBe(63); // 2.5% of $25.00, rounded
    expect(donation!.netCents).toBe(2437);
    expect(donation!.donorEmail).toBe(YUSUF);
    expect(donation!.message).toBe('For the Saturday class');
    expect(donation!.stripeCheckoutSessionId).toMatch(/^cs_test_/);

    const session = stripe.calls.checkoutSessionsCreate[0] as {
      mode: string;
      customer_email: string;
      success_url: string;
      payment_intent_data: {
        application_fee_amount: number;
        transfer_data: { destination: string };
      };
    };
    expect(session.mode).toBe('payment');
    expect(session.customer_email).toBe(YUSUF);
    expect(session.payment_intent_data.application_fee_amount).toBe(63);
    expect(session.payment_intent_data.transfer_data.destination).toBe('acct_test_ready');
    // Stripe only accepts http(s) here, so the default lands on our return page.
    expect(session.success_url).toMatch(/\/donations\/return\?status=success/);
  });

  it('rejects an amount below the floor', async () => {
    await enablePayouts(KHADIJA_ID);
    const token = await tokenFor(YUSUF);
    const res = await api
      .post(`/api/mosques/${KHADIJA_ID}/donations/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 100 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a javascript: return URL', async () => {
    await enablePayouts(KHADIJA_ID);
    const token = await tokenFor(YUSUF);
    const res = await api
      .post(`/api/mosques/${KHADIJA_ID}/donations/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 2500, successUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
    expect(stripe.calls.checkoutSessionsCreate).toHaveLength(0);
  });

  it('accepts the app scheme as a return URL and still hands Stripe an http one', async () => {
    await enablePayouts(KHADIJA_ID);
    const token = await tokenFor(YUSUF);
    await api
      .post(`/api/mosques/${KHADIJA_ID}/donations/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 2500, successUrl: `${env.APP_SCHEME}://donate/success` })
      .expect(201);
    const session = stripe.calls.checkoutSessionsCreate[0] as { success_url: string };
    expect(session.success_url).toMatch(/^http/);
  });

  it('renders the return page with a deep link back to the app', async () => {
    const res = await api.get('/donations/return?status=success').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain(`${env.APP_SCHEME}://donate/success`);

    const cancelled = await api.get('/donations/return?status=anything-else').expect(200);
    expect(cancelled.text).toContain(`${env.APP_SCHEME}://donate/cancelled`);
  });
});

// ─── Webhook ────────────────────────────────────────────────────────────────

describe('stripe webhook', () => {
  it('rejects a bad signature with 400 and records nothing', async () => {
    const res = await postWebhook(stripeEvent('account.updated', { id: 'acct_x' }), 'forged');
    expect(res.status).toBe(400);
    expect(await StripeEventModel.countDocuments({})).toBe(0);
  });

  it('rejects a missing signature', async () => {
    const res = await api
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(stripeEvent('account.updated', { id: 'acct_x' })));
    expect(res.status).toBe(400);
  });

  it('settles a donation on checkout.session.completed and emails a receipt', async () => {
    await enablePayouts(KHADIJA_ID);
    const token = await tokenFor(YUSUF);
    await api
      .post(`/api/mosques/${KHADIJA_ID}/donations/checkout`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 5000 })
      .expect(201);
    const donation = await DonationModel.findOne({ mosqueId: KHADIJA_ID, method: 'card' });
    sentEmails.length = 0;

    await postWebhook(
      stripeEvent('checkout.session.completed', {
        id: donation!.stripeCheckoutSessionId,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        payment_intent: 'pi_test_0001',
        customer_details: { email: YUSUF },
        metadata: { kind: 'donation', donationId: donation!._id, mosqueId: KHADIJA_ID },
      }),
    ).expect(200);

    const settled = await DonationModel.findById(donation!._id);
    expect(settled?.status).toBe('settled');
    expect(settled?.stripePaymentIntentId).toBe('pi_test_0001');

    const receipt = sentEmails.find((m) => m.to === YUSUF);
    expect(receipt).toBeDefined();
    expect(receipt!.text).toContain('$50.00 CAD');
    expect(receipt!.text).toContain('Khadijah Islamic Center');
    // The tax receipt is the mosque's to issue, and the email says so.
    expect(receipt!.text).toMatch(/issued by the mosque/);

    // Stripe ids never reach the console's donation table either.
    const admin = await superAdminToken();
    const list = await api
      .get(`/api/admin/billing/donations?mosqueId=${KHADIJA_ID}`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    const row = list.body.data.items.find((d: { _id: string }) => d._id === donation!._id);
    expect(row.status).toBe('settled');
    expect(row.stripePaymentIntentId).toBeUndefined();
    expect(row.stripeCheckoutSessionId).toBeUndefined();
  });

  it('marks a donation refunded on charge.refunded', async () => {
    await enablePayouts(KHADIJA_ID);
    await DonationModel.create({
      _id: 'don_refund_me',
      mosqueId: KHADIJA_ID,
      amountCents: 1000,
      feeCents: 25,
      netCents: 975,
      currency: 'CAD',
      status: 'settled',
      method: 'card',
      stripePaymentIntentId: 'pi_test_refund',
      createdAt: new Date(),
    });
    await postWebhook(
      stripeEvent('charge.refunded', {
        id: 'ch_test_1',
        object: 'charge',
        payment_intent: 'pi_test_refund',
        refunded: true,
        amount_refunded: 1000,
      }),
    ).expect(200);
    const row = await DonationModel.findById('don_refund_me');
    expect(row?.status).toBe('refunded');
  });

  function paidInvoiceEvent(subId: string, stripeSubId: string, invoiceId: string, eventId?: string) {
    return stripeEvent(
      'invoice.paid',
      {
        id: invoiceId,
        object: 'invoice',
        customer: 'cus_test_0001',
        currency: 'cad',
        subtotal: 4900,
        total: 5634,
        amount_paid: 5634,
        amount_due: 5634,
        created: 1_800_000_000,
        due_date: null,
        status: 'paid',
        status_transitions: { paid_at: 1_800_000_100 },
        total_taxes: [
          { amount: 245, type: 'tax_rate_details' },
          { amount: 489, type: 'tax_rate_details' },
        ],
        parent: {
          type: 'subscription_details',
          subscription_details: {
            subscription: stripeSubId,
            metadata: { mosqueId: KHADIJA_ID, subscriptionId: subId },
          },
        },
        lines: {
          object: 'list',
          data: [
            {
              id: 'il_test_1',
              object: 'line_item',
              description: "1 × M'Ensemble — Khadijah Islamic Center (at $49.00 / month)",
              amount: 4900,
              quantity: 1,
              period: { start: 1_800_000_000, end: 1_802_592_000 },
            },
          ],
        },
      },
      eventId,
    );
  }

  it('writes an Invoice and a Payment on invoice.paid and activates the subscription', async () => {
    const subId = await khadijaSubscriptionId();
    await SubscriptionModel.updateOne({ _id: subId }, { $set: { status: 'past_due' } });
    const invoicesBefore = await InvoiceModel.countDocuments({ mosqueId: KHADIJA_ID });

    await postWebhook(paidInvoiceEvent(subId, 'sub_test_paid', 'in_test_0001')).expect(200);

    const invoice = await InvoiceModel.findOne({ mosqueId: KHADIJA_ID, note: 'Stripe invoice in_test_0001' });
    expect(invoice).not.toBeNull();
    expect(invoice!.kind).toBe('subscription');
    expect(invoice!.sourceId).toBe(subId);
    expect(invoice!.status).toBe('paid');
    expect(invoice!.subtotalCents).toBe(4900);
    expect(invoice!.taxCents).toBe(734);
    expect(invoice!.totalCents).toBe(5634);
    expect(invoice!.paidCents).toBe(5634);
    expect(invoice!.dueCents).toBe(0);
    expect(invoice!.number).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(invoice!.lines[0]!.amountCents).toBe(4900);
    expect(invoice!.createdBy).toBe('stripe');

    const payment = await PaymentModel.findOne({ invoiceId: invoice!._id });
    expect(payment).not.toBeNull();
    expect(payment!.method).toBe('card');
    expect(payment!.reference).toBe('in_test_0001');
    expect(payment!.recordedBy).toBe('stripe');
    expect(payment!.amountCents).toBe(5634);

    const sub = await SubscriptionModel.findById(subId);
    expect(sub?.status).toBe('active');
    expect(sub?.externalRef).toBe('sub_test_paid');
    expect(sub?.collectionMethod).toBe('stripe');
    expect(sub?.lastStripeInvoiceStatus).toBe('paid');
    expect(sub?.currentPeriodStart.getTime()).toBe(1_800_000_000 * 1000);
    expect(sub?.currentPeriodEnd.getTime()).toBe(1_802_592_000 * 1000);

    expect(await InvoiceModel.countDocuments({ mosqueId: KHADIJA_ID })).toBe(invoicesBefore + 1);

    // It shows up where the console looks, through the ordinary rows.
    const token = await superAdminToken();
    const detail = await api
      .get(`/api/admin/mosques/${KHADIJA_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.invoices.some((i: { _id: string }) => i._id === invoice!._id)).toBe(
      true,
    );
    expect(detail.body.data.subscription.collection).toBe('stripe');
  });

  it('is idempotent — the same event twice writes one invoice', async () => {
    const subId = await khadijaSubscriptionId();
    const event = paidInvoiceEvent(subId, 'sub_test_dup', 'in_test_dup', 'evt_test_dup');

    const first = await postWebhook(event).expect(200);
    expect(first.body.outcome).toBe('processed');
    const second = await postWebhook(event).expect(200);
    expect(second.body.outcome).toBe('duplicate');

    expect(await InvoiceModel.countDocuments({ note: 'Stripe invoice in_test_dup' })).toBe(1);
    expect(await PaymentModel.countDocuments({ reference: 'in_test_dup' })).toBe(1);

    // And a *different* event for the same Stripe invoice (a retry under a new
    // id, or `payment_succeeded` alongside `paid`) still writes nothing new.
    await postWebhook(paidInvoiceEvent(subId, 'sub_test_dup', 'in_test_dup')).expect(200);
    expect(await InvoiceModel.countDocuments({ note: 'Stripe invoice in_test_dup' })).toBe(1);

    const rows = await StripeEventModel.find({});
    expect(rows.every((r) => r.processedAt && !r.error)).toBe(true);
  });

  it('marks the subscription past_due on invoice.payment_failed and tells the coordinators', async () => {
    const subId = await khadijaSubscriptionId();
    await SubscriptionModel.updateOne({ _id: subId }, { $set: { externalRef: 'sub_test_fail' } });

    await postWebhook(
      stripeEvent('invoice.payment_failed', {
        id: 'in_test_fail',
        object: 'invoice',
        customer: 'cus_test_0001',
        amount_due: 5634,
        parent: {
          type: 'subscription_details',
          subscription_details: { subscription: 'sub_test_fail', metadata: {} },
        },
      }),
    ).expect(200);

    const sub = await SubscriptionModel.findById(subId);
    expect(sub?.status).toBe('past_due');
    expect(sub?.lastStripeInvoiceStatus).toBe('open');
    const mail = sentEmails.find((m) => m.to === AMINA);
    expect(mail).toBeDefined();
    expect(mail!.text).toMatch(/did not go through/);
  });

  it('follows customer.subscription.updated and .deleted', async () => {
    const subId = await khadijaSubscriptionId();
    await SubscriptionModel.updateOne({ _id: subId }, { $set: { externalRef: 'sub_test_life' } });

    await postWebhook(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_test_life',
        object: 'subscription',
        status: 'past_due',
        customer: 'cus_test_0001',
        canceled_at: null,
        trial_end: null,
        metadata: {},
        items: { data: [{ current_period_start: 1_800_000_000, current_period_end: 1_802_592_000 }] },
      }),
    ).expect(200);
    expect((await SubscriptionModel.findById(subId))?.status).toBe('past_due');

    await postWebhook(
      stripeEvent('customer.subscription.deleted', {
        id: 'sub_test_life',
        object: 'subscription',
        status: 'canceled',
        customer: 'cus_test_0001',
        canceled_at: 1_802_592_000,
        metadata: {},
        items: { data: [] },
      }),
    ).expect(200);
    const sub = await SubscriptionModel.findById(subId);
    expect(sub?.status).toBe('cancelled');
    expect(sub?.cancelledAt?.getTime()).toBe(1_802_592_000 * 1000);
  });

  it('records a handler failure on the event row and still answers 200', async () => {
    const res = await postWebhook(
      stripeEvent('customer.subscription.updated', {
        id: 'sub_nobody_knows',
        object: 'subscription',
        status: 'active',
        customer: 'cus_nobody',
        metadata: {},
        items: { data: [] },
      }),
    );
    expect(res.status).toBe(200);
    const row = await StripeEventModel.findOne({ type: 'customer.subscription.updated' });
    expect(row?.error).toMatch(/No subscription/);
    expect(row?.processedAt).toBeUndefined();
  });
});

// ─── Connect ────────────────────────────────────────────────────────────────

describe('mosque payouts (Connect)', () => {
  it('creates an Express account once and mints a fresh onboarding link each time', async () => {
    const token = await superAdminToken();

    const first = await api
      .post(`/api/admin/mosques/${KHADIJA_ID}/payouts/onboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(first.body.data.url).toMatch(/^https:\/\/connect\.stripe\.test\/setup\/acct_test_/);

    await api
      .post(`/api/admin/mosques/${KHADIJA_ID}/payouts/onboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(stripe.calls.accountsCreate).toHaveLength(1);
    expect(stripe.calls.accountsCreate[0]).toMatchObject({
      type: 'express',
      country: env.STRIPE_CONNECT_COUNTRY,
      business_type: 'non_profit',
      metadata: { mosqueId: KHADIJA_ID },
    });
    expect(stripe.calls.accountLinksCreate).toHaveLength(2);

    // Not enabled yet — the account exists but Stripe still wants paperwork.
    const detail = await api
      .get(`/api/admin/mosques/${KHADIJA_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.data.payouts).toMatchObject({
      chargesEnabled: false,
      detailsSubmitted: false,
      requirementsDue: ['external_account', 'representative.dob.day'],
    });
    expect(detail.body.data.payouts.stripeAccountId).toMatch(/^acct_test_/);
    expect(detail.body.data.mosque.donationsEnabled).toBe(false);
  });

  it('refresh re-reads the account', async () => {
    const token = await superAdminToken();
    await api
      .post(`/api/admin/mosques/${KHADIJA_ID}/payouts/onboard`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const mosque = await MosqueModel.findById(KHADIJA_ID);
    const account = stripe.accounts.get(mosque!.stripeAccountId!)!;
    Object.assign(account, {
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [] },
    });

    const res = await api
      .post(`/api/admin/mosques/${KHADIJA_ID}/payouts/refresh`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data).toMatchObject({ chargesEnabled: true, payoutsEnabled: true, requirementsDue: [] });
  });

  it('refresh is a 409 before onboarding has started', async () => {
    const token = await superAdminToken();
    const res = await api
      .post(`/api/admin/mosques/${KHADIJA_ID}/payouts/refresh`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('account.updated enables donations in the app without exposing the account id', async () => {
    await MosqueModel.updateOne({ _id: KHADIJA_ID }, { $set: { stripeAccountId: 'acct_test_hook' } });
    const token = await tokenFor(YUSUF);

    const before = await api
      .get(`/api/mosques/${KHADIJA_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(before.body.data.donationsEnabled).toBe(false);

    await postWebhook(
      stripeEvent('account.updated', {
        id: 'acct_test_hook',
        object: 'account',
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
        requirements: { currently_due: ['external_account'] },
      }),
    ).expect(200);

    const after = await api
      .get(`/api/mosques/${KHADIJA_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(after.body.data.donationsEnabled).toBe(true);
    expect(after.body.data.stripeAccountId).toBeUndefined();
    expect(after.body.data.payouts).toBeUndefined();
    expect(JSON.stringify(after.body)).not.toContain('acct_test_hook');

    // The list endpoint is built from the same transform.
    const list = await api.get('/api/mosques').set('Authorization', `Bearer ${token}`).expect(200);
    expect(JSON.stringify(list.body)).not.toContain('acct_test_hook');
    const row = list.body.data.find((m: { _id: string }) => m._id === KHADIJA_ID);
    expect(row.donationsEnabled).toBe(true);

    // The console sees the whole picture.
    const admin = await superAdminToken();
    const detail = await api
      .get(`/api/admin/mosques/${KHADIJA_ID}`)
      .set('Authorization', `Bearer ${admin}`)
      .expect(200);
    expect(detail.body.data.payouts).toMatchObject({
      stripeAccountId: 'acct_test_hook',
      chargesEnabled: true,
      payoutsEnabled: false,
      requirementsDue: ['external_account'],
    });
  });

  it('a Connect route is superadmin-only', async () => {
    const token = await tokenFor(AMINA);
    const res = await api
      .post(`/api/admin/mosques/${KHADIJA_ID}/payouts/onboard`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─── The manual path is untouched ───────────────────────────────────────────

describe('manual billing still works alongside Stripe', () => {
  it('a hand-recorded payment still settles an invoice', async () => {
    const token = await superAdminToken();
    const created = await api
      .post('/api/admin/billing/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'subscription',
        mosqueId: KHADIJA_ID,
        lines: [{ description: 'October', quantity: 1, unitCents: 4900 }],
        taxCents: 734,
        issue: true,
      })
      .expect(201);
    const invoice = created.body.data;
    expect(invoice.status).toBe('open');
    expect(invoice.dueCents).toBe(5634);

    const paid = await api
      .post(`/api/admin/billing/invoices/${invoice._id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountCents: 5634, method: 'etransfer', reference: 'ET-1' })
      .expect(201);
    expect(paid.body.data.invoice.status).toBe('paid');
    expect(paid.body.data.invoice.dueCents).toBe(0);
  });

  it('PATCH accepts collection and province', async () => {
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();
    const res = await api
      .patch(`/api/admin/billing/subscriptions/${subId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ collection: 'manual', province: 'ON' })
      .expect(200);
    expect(res.body.data.collection).toBe('manual');
    expect(res.body.data.province).toBe('ON');
  });

  it('a subscription without a Stripe key and without the fake is a 503, not a crash', async () => {
    setStripeClientForTests(null);
    const token = await superAdminToken();
    const subId = await khadijaSubscriptionId();
    const res = await api
      .post(`/api/admin/billing/subscriptions/${subId}/checkout`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('STRIPE_UNAVAILABLE');
  });
});
