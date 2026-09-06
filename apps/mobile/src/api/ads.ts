import type { AdPlacement, ServedAd } from '@m-ensemble/shared';
import { request } from './http';

/**
 * Partner cards in the feed.
 *
 * **Deliberately not part of `MEnsembleApi`.** That interface is the locked
 * domain contract — the one the mock client mirrors and the derived-view oracle
 * compares against — and ads are a commercial concern bolted alongside it, not
 * part of what a mosque and its members do. Keeping them in their own module
 * means the contract stays the shape it was designed as, and the mock does not
 * grow two methods nothing tests.
 *
 * **What leaves the phone.** The slot request sends a placement, the city being
 * browsed, and optionally the mosque whose screen this is. It does **not** send
 * who you are — targeting on interests happens on the server, against the
 * account the token already identifies, so no profile is assembled client-side
 * and nothing about the reader reaches the partner.
 */

export interface AdSlotRequest {
  placement: AdPlacement;
  /** The city id the reader is browsing, as the app already knows it. */
  city?: string;
  /** Set on a mosque profile or a post detail. */
  mosqueId?: string;
  limit?: number;
}

/**
 * The ads for one slot, or an empty list.
 *
 * **Never throws.** An ad is the least important thing on any screen it appears
 * on, and a failed request for one must not turn a mosque's feed into an error
 * state. A failure here is an empty array and a line in the log.
 */
export async function getAds(input: AdSlotRequest): Promise<ServedAd[]> {
  const params = new URLSearchParams({ placement: input.placement });
  if (input.city) params.set('city', input.city);
  if (input.mosqueId) params.set('mosqueId', input.mosqueId);
  if (input.limit) params.set('limit', String(input.limit));

  try {
    return await request<ServedAd[]>(`/ads/slot?${params.toString()}`);
  } catch (err) {
    console.warn('[ads] could not load a slot', err);
    return [];
  }
}

/**
 * Tell the server a card was seen or tapped.
 *
 * Fire-and-forget, and silent on failure for the same reason: there is no
 * screen on this end that could act on the error, and a rejected promise here
 * would surface as an unhandled rejection during an ordinary scroll.
 */
export function reportAdEvent(campaignId: string, kind: 'impression' | 'click'): void {
  void request(`/ads/${campaignId}/events`, {
    method: 'POST',
    body: JSON.stringify({ kind }),
  }).catch(() => {
    /* counted or not, the reader's screen is unaffected */
  });
}
