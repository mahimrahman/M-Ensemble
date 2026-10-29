import Stripe from 'stripe';
import { env, hasStripe } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

/**
 * The one Stripe client.
 *
 * Built lazily so a server without a key still boots — every route that needs
 * Stripe asks for it through `requireStripe()` and gets a 503 if there is none,
 * instead of the process failing at import time over a feature that is off.
 *
 * `apiVersion` is deliberately not pinned here: the installed SDK already sends
 * the version its types were generated from, and repeating that string by hand
 * is one more place for it to drift from the types we compile against.
 *
 * Under test there is no key. `setStripeClientForTests` lets the suite inject
 * an in-memory fake that answers the handful of calls we make, and the fake
 * wins over the environment so the webhook and checkout paths can be exercised
 * end to end without a network.
 */

let client: Stripe | null = null;
let injected: Stripe | null = null;

export function requireStripe(): Stripe {
  if (injected) return injected;
  if (!hasStripe) {
    throw new HttpError(503, 'STRIPE_UNAVAILABLE', 'Payments are not configured.');
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY!, {
    typescript: true,
    appInfo: { name: "M'Ensemble", url: env.PUBLIC_WEB_URL },
  });
  return client;
}

/**
 * The secret the webhook signature is checked against. With a fake client
 * injected there is no real signature to verify, so any non-empty value will do
 * — the fake's `constructEvent` decides what counts as valid.
 */
export function webhookSecret(): string | null {
  if (injected) return 'whsec_test';
  return env.STRIPE_WEBHOOK_SECRET ?? null;
}

/** Test seam. Pass `null` to go back to the real client. */
export function setStripeClientForTests(fake: Stripe | null): void {
  injected = fake;
}
