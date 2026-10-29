import { ApiError } from '@/api';

/**
 * The two ways a Stripe call fails that are not the operator's fault.
 *
 * A server without Stripe keys answers 503 `STRIPE_UNAVAILABLE` to every
 * payments endpoint. That is a deployment state, not an error in what the
 * operator did, so the toast should say so calmly — the raw server sentence
 * reads like an outage. Everything else passes through untouched, because the
 * server writes those messages for people already.
 */
export const STRIPE_UNAVAILABLE_MESSAGE =
  "Payments aren't configured on this server yet. Collect this one manually until Stripe is set up.";

export async function viaStripe<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof ApiError && err.code === 'STRIPE_UNAVAILABLE') {
      throw new ApiError(err.status, err.code, STRIPE_UNAVAILABLE_MESSAGE);
    }
    throw err;
  }
}

/**
 * Open a Stripe page in a new tab, and say whether the browser let us.
 *
 * The link arrives after an `await`, which is outside the click that popup
 * blockers trust — so `window.open` can return null here. Callers fall back to
 * showing the link for the operator to click themselves rather than losing it.
 */
export function openInNewTab(url: string): boolean {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  return win !== null;
}
