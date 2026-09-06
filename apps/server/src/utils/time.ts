export const DAY_MS = 24 * 60 * 60 * 1000;

interface Span {
  startAt: Date;
  endAt: Date;
}

interface Lifecycle extends Span {
  cancelledAt?: Date;
}

/** Minutes a post runs for — what one attended shift is worth. */
export function postMinutes(post: Span): number {
  const mins = (post.endAt.getTime() - post.startAt.getTime()) / 60000;
  return Math.max(0, Math.round(mins));
}

/** In the feed: not cancelled, and not over yet. */
export function isLive(post: Lifecycle, now: number): boolean {
  return !post.cancelledAt && post.endAt.getTime() >= now;
}

/** Counts towards attendance and outcomes: not cancelled, already finished. */
export function isEnded(post: Lifecycle, now: number): boolean {
  return !post.cancelledAt && post.endAt.getTime() < now;
}

/**
 * The Mongo half of `isLive`. `$exists` rather than `$eq: null` — the schema
 * never writes a null and cancelling uses `$set`, so mixing the two idioms is
 * how a cancelled post finds its way back into the feed.
 */
export function liveFilter(now: Date) {
  return { cancelledAt: { $exists: false }, endAt: { $gte: now } };
}
