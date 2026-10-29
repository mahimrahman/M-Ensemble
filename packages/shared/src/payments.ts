/**
 * Payments — the Stripe edge of the billing model in `./platform`.
 *
 * `platform.ts` models the money: subscriptions, invoices, donations. This
 * file is how the money actually moves. Two Stripe products:
 *
 *   - **Billing** charges a mosque for its subscription. The console creates a
 *     Checkout link, the mosque pays on Stripe's page, and the webhook flips
 *     `Subscription.status` and writes the `Invoice` and `Payment` rows.
 *   - **Connect** lets a member donate to a mosque. Each mosque onboards as an
 *     Express account; a donation is a Checkout session on the platform with a
 *     `transfer_data.destination` of the mosque and an application fee of
 *     `platformFeeCents`. We never hold the money.
 *
 * Nothing in the app talks to Stripe directly. Both flows hand back a URL,
 * and the phone or browser opens it.
 */

import type { ID, Timestamp } from './types';

// ─── Checkout links ─────────────────────────────────────────────────────────

/** A hosted page on Stripe to send somebody to. Short-lived. */
export interface CheckoutLink {
  url: string;
  /** When Stripe stops honouring it. */
  expiresAt?: Timestamp;
}

/** How a subscription is collected. `manual` is the bank-transfer path. */
export type CollectionMethod = 'stripe' | 'manual';

/**
 * What a member sends to donate. The server computes the fee; the client only
 * says how much and, optionally, for what.
 */
export interface CreateDonationCheckoutInput {
  amountCents: number;
  /** Set when the gift is for a specific event or class. */
  postId?: ID;
  /** Shown to the mosque on the receipt. Optional, short. */
  message?: string;
  /** Where the browser goes afterwards. The app passes its own deep links. */
  successUrl?: string;
  cancelUrl?: string;
}

/** Donation limits, enforced on both ends. */
export const DONATION_MIN_CENTS = 500;
export const DONATION_MAX_CENTS = 1_000_000;

/** The preset amounts the donate screen offers, in cents. */
export const DONATION_PRESETS_CENTS: readonly number[] = [1000, 2500, 5000, 10000, 25000];

// ─── Connect (mosque payouts) ───────────────────────────────────────────────

/**
 * Where a mosque's payout account stands. Mirrors the Stripe account's
 * capability flags, refreshed from the webhook and on demand.
 */
export interface PayoutAccountStatus {
  stripeAccountId: string;
  /** Stripe will accept charges destined for this account. */
  chargesEnabled: boolean;
  /** Stripe will pay the balance out to the mosque's bank. */
  payoutsEnabled: boolean;
  /** The mosque has finished the onboarding form. */
  detailsSubmitted: boolean;
  /** Fields Stripe still wants, if any — shown to the operator. */
  requirementsDue: string[];
  updatedAt: Timestamp;
}

// ─── Tax ────────────────────────────────────────────────────────────────────

/**
 * Canadian sales tax, in basis points, by province of the customer.
 *
 * Quebec is GST + QST; the HST provinces fold both into one rate; the rest
 * are GST only plus a PST we do not collect until registered there. These feed
 * the manual-invoice path. The Stripe path uses Stripe Tax when enabled, and
 * these same rates as fixed tax rates when it is not.
 */
export type Province =
  | 'AB'
  | 'BC'
  | 'MB'
  | 'NB'
  | 'NL'
  | 'NS'
  | 'NT'
  | 'NU'
  | 'ON'
  | 'PE'
  | 'QC'
  | 'SK'
  | 'YT';

export interface TaxLine {
  /** `GST`, `QST`, `HST`. */
  code: string;
  rateBps: number;
}

export const TAX_LINES: Record<Province, TaxLine[]> = {
  QC: [
    { code: 'GST', rateBps: 500 },
    { code: 'QST', rateBps: 997.5 },
  ],
  ON: [{ code: 'HST', rateBps: 1300 }],
  NB: [{ code: 'HST', rateBps: 1500 }],
  NL: [{ code: 'HST', rateBps: 1500 }],
  NS: [{ code: 'HST', rateBps: 1400 }],
  PE: [{ code: 'HST', rateBps: 1500 }],
  AB: [{ code: 'GST', rateBps: 500 }],
  BC: [{ code: 'GST', rateBps: 500 }],
  MB: [{ code: 'GST', rateBps: 500 }],
  SK: [{ code: 'GST', rateBps: 500 }],
  NT: [{ code: 'GST', rateBps: 500 }],
  NU: [{ code: 'GST', rateBps: 500 }],
  YT: [{ code: 'GST', rateBps: 500 }],
};

export const DEFAULT_PROVINCE: Province = 'QC';

/** Total tax on a subtotal, rounded once per line as the CRA expects. */
export function taxCentsFor(subtotalCents: number, province: Province = DEFAULT_PROVINCE): number {
  return TAX_LINES[province].reduce(
    (sum, line) => sum + Math.round((subtotalCents * line.rateBps) / 10_000),
    0,
  );
}

/** Each tax line's amount, for an invoice that itemises them. */
export function taxBreakdown(
  subtotalCents: number,
  province: Province = DEFAULT_PROVINCE,
): { code: string; rateBps: number; amountCents: number }[] {
  return TAX_LINES[province].map((line) => ({
    ...line,
    amountCents: Math.round((subtotalCents * line.rateBps) / 10_000),
  }));
}
