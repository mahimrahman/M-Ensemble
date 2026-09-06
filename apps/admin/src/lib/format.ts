import type { PlanId } from '@m-ensemble/shared';

/**
 * Formatting and the handful of constants the console needs at runtime.
 *
 * These are duplicated from `@m-ensemble/shared` rather than imported, because
 * a *runtime* import of that package would pull CommonJS TypeScript source into
 * a browser bundle — see the note in `api.ts`. The duplication is four small
 * pure functions and one price table, and the server remains the authority: it
 * computes every total this file only renders.
 */

/** `1234567` → `"$12,345.67"`. */
export function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-CA')}.${String(abs % 100).padStart(2, '0')}`;
}

/** `$12.3k` — for axis ticks and tiles, where two decimals are noise. */
export function moneyShort(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(1)}k`;
  return `$${dollars.toLocaleString('en-CA')}`;
}

export function count(n: number): string {
  return n.toLocaleString('en-CA');
}

export function countShort(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function percent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

/** `2026-09-06` or an ISO instant → `6 Sep 2026`. */
export function date(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function dateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-CA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "3 days ago", "in 2 weeks". The unit that keeps the number under ten. */
export function relative(value?: string | null): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';

  const seconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (abs < 60) return rtf.format(seconds, 'second');
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), 'hour');
  if (abs < 2_592_000) return rtf.format(Math.round(seconds / 86_400), 'day');
  if (abs < 31_536_000) return rtf.format(Math.round(seconds / 2_592_000), 'month');
  return rtf.format(Math.round(seconds / 31_536_000), 'year');
}

/** `YYYY-MM` → `Sep 26`, for the revenue chart's axis. */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-');
  const d = new Date(Number(year), Number(m) - 1, 1);
  return d.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' });
}

/** `YYYY-MM-DD` → `6 Sep`, for the daily charts. */
export function dayLabel(day: string): string {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString('en-CA', { day: 'numeric', month: 'short' });
}

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Free',
  standard: 'Standard',
  pro: 'Pro',
};

/** List price per month, in cents. Mirrors `PLANS` in the contract. */
export const PLAN_PRICES: Record<PlanId, number> = { free: 0, standard: 4900, pro: 12900 };

export const PLAN_IDS: PlanId[] = ['free', 'standard', 'pro'];

/** Turns any label into something readable: `past_due` → `Past due`. */
export function humanise(value: string): string {
  const spaced = value.replace(/[_-]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `"2026-09-06T18:30:00.000Z"` → the value a `datetime-local` input wants. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
