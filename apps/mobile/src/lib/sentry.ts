/**
 * Crash reporting. Off unless a DSN is baked into a release build, so a dev
 * run without one is untouched: no network, no wrapper around the root, no
 * noise in the console.
 *
 * Only the user *id* is attached to events — never the email or the name. It
 * is enough to pull every crash one person hit, and nothing more leaves the
 * phone than already has to.
 */

import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/** True in exactly the builds that report: a DSN present, and not `__DEV__`. */
export const sentryEnabled = !!dsn && !__DEV__;

Sentry.init({
  dsn,
  enabled: sentryEnabled,
  tracesSampleRate: 0.2,
});

/** Called on sign-in and on a warm start; `null` on sign-out. */
export function setSentryUser(id: string | null): void {
  if (!sentryEnabled) return;
  Sentry.setUser(id ? { id } : null);
}

/**
 * Wraps the root component in Sentry's error boundary and touch tracking —
 * only when reporting is on, so the dev tree is exactly what it was.
 */
type Root = ComponentType<Record<string, unknown>>;

export function withSentry(Root: Root): Root {
  return sentryEnabled ? Sentry.wrap(Root) : Root;
}
