import type Stripe from 'stripe';

/**
 * An in-memory stand-in for the Stripe client, covering exactly the calls the
 * server makes and nothing else. Every method records what it was asked so a
 * test can assert on the request, and answers with an object shaped closely
 * enough to Stripe's that the service code does not notice.
 *
 * `webhooks.constructEvent` is where the signature check lives: anything but
 * the literal header `valid` is rejected, so the route's 400 path is testable
 * without computing an HMAC.
 */

type Params = Record<string, unknown>;

export interface StripeMock {
  calls: {
    customersCreate: Params[];
    checkoutSessionsCreate: Params[];
    portalSessionsCreate: Params[];
    accountsCreate: Params[];
    accountsRetrieve: string[];
    accountLinksCreate: Params[];
    subscriptionsRetrieve: string[];
  };
  /** Accounts by id, so a test can flip `charges_enabled` before a refresh. */
  accounts: Map<string, Record<string, unknown>>;
  /** Subscriptions by id, for `subscriptions.retrieve` after Checkout. */
  subscriptions: Map<string, Record<string, unknown>>;
  /** Cast this to `Stripe` and hand it to `setStripeClientForTests`. */
  client: Stripe;
}

export function createStripeMock(): StripeMock {
  let seq = 0;
  const next = (prefix: string) => `${prefix}_test_${String(++seq).padStart(4, '0')}`;
  const inADay = () => Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const calls: StripeMock['calls'] = {
    customersCreate: [],
    checkoutSessionsCreate: [],
    portalSessionsCreate: [],
    accountsCreate: [],
    accountsRetrieve: [],
    accountLinksCreate: [],
    subscriptionsRetrieve: [],
  };
  const accounts = new Map<string, Record<string, unknown>>();
  const subscriptions = new Map<string, Record<string, unknown>>();

  const client = {
    customers: {
      async create(params: Params) {
        calls.customersCreate.push(params);
        return { id: next('cus'), object: 'customer', ...params };
      },
    },
    checkout: {
      sessions: {
        async create(params: Params) {
          calls.checkoutSessionsCreate.push(params);
          const id = next('cs');
          return {
            id,
            object: 'checkout.session',
            url: `https://checkout.stripe.test/pay/${id}`,
            expires_at: inADay(),
            status: 'open',
            payment_status: 'unpaid',
            ...params,
          };
        },
      },
    },
    billingPortal: {
      sessions: {
        async create(params: Params) {
          calls.portalSessionsCreate.push(params);
          return {
            id: next('bps'),
            object: 'billing_portal.session',
            url: `https://billing.stripe.test/session/${seq}`,
            ...params,
          };
        },
      },
    },
    accounts: {
      async create(params: Params) {
        calls.accountsCreate.push(params);
        const id = next('acct');
        const account = {
          id,
          object: 'account',
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          requirements: { currently_due: ['external_account', 'representative.dob.day'] },
          ...params,
        };
        accounts.set(id, account);
        return account;
      },
      async retrieve(id: string) {
        calls.accountsRetrieve.push(id);
        const account = accounts.get(id);
        if (!account) throw new Error(`No such account: ${id}`);
        return account;
      },
    },
    accountLinks: {
      async create(params: Params) {
        calls.accountLinksCreate.push(params);
        return {
          object: 'account_link',
          url: `https://connect.stripe.test/setup/${String(params.account)}`,
          expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
          created: Math.floor(Date.now() / 1000),
        };
      },
    },
    subscriptions: {
      async retrieve(id: string) {
        calls.subscriptionsRetrieve.push(id);
        const now = Math.floor(Date.now() / 1000);
        return (
          subscriptions.get(id) ?? {
            id,
            object: 'subscription',
            status: 'active',
            customer: 'cus_test_unknown',
            canceled_at: null,
            trial_end: null,
            metadata: {},
            items: {
              data: [{ current_period_start: now, current_period_end: now + 30 * 24 * 60 * 60 }],
            },
          }
        );
      },
    },
    webhooks: {
      constructEvent(payload: Buffer | string, signature: string, _secret: string) {
        if (signature !== 'valid') {
          throw new Error('No signatures found matching the expected signature for payload');
        }
        return JSON.parse(payload.toString());
      },
    },
  };

  return { calls, accounts, subscriptions, client: client as unknown as Stripe };
}
