/**
 * Date/time helpers for the admin forms. Everything an admin types is mosque
 * wall-clock; these turn it into the ISO instants the contract stores.
 */

import { MOSQUE_TIMEZONE, dateStringIn, fromWallClock, toWallClock } from './prayer';
import type { Lang } from '@/i18n/strings';
import type { DateString, PostSession, Timestamp, WallClock } from '@/types';

const WALL_CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isWallClock(value: string): value is WallClock {
  return WALL_CLOCK.test(value);
}

export function isDateString(value: string): value is DateString {
  return DATE.test(value);
}

/** Today in the mosque's calendar, `offset` days on. */
export function mosqueDate(offset = 0): DateString {
  return dateStringIn(MOSQUE_TIMEZONE, new Date(), offset);
}

/** `date` + `time` on the mosque's wall → the instant to store. */
export function toInstant(date: DateString, time: WallClock): Timestamp {
  return fromWallClock(date, time, MOSQUE_TIMEZONE).toISOString();
}

/** The reverse, for prefilling an edit form from a stored post. */
export function fromInstant(iso: Timestamp): { date: DateString; time: WallClock } {
  const at = new Date(iso);
  return { date: dateStringIn(MOSQUE_TIMEZONE, at, 0), time: toWallClock(at, MOSQUE_TIMEZONE) };
}

/** Same day of the week, `weeks` later. */
export function addWeeks(date: DateString, weeks: number): DateString {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  const mm = `${shifted.getUTCMonth() + 1}`.padStart(2, '0');
  const dd = `${shifted.getUTCDate()}`.padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${mm}-${dd}`;
}

/** Weekly sessions from a first meeting — how a class gets its schedule. */
export function weeklySessions(
  firstDate: DateString,
  start: WallClock,
  end: WallClock,
  count: number,
): PostSession[] {
  return Array.from({ length: Math.max(count, 1) }, (_, i) => {
    const date = addWeeks(firstDate, i);
    return { startAt: toInstant(date, start), endAt: toInstant(date, end) };
  });
}

/**
 * Short day label for a picker: "Sat 12" / "Today".
 *
 * `locale` is the app's language, not the device's, and `todayLabel` is the
 * translated word — the strip must read in the language the rest of the
 * screen is in.
 */
export function dayLabel(
  date: DateString,
  locale: string,
  todayLabel: string,
): { weekday: string; day: string } {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const at = new Date(y, m - 1, d, 12);
  const isToday = date === mosqueDate(0);
  return {
    weekday: isToday ? todayLabel : at.toLocaleDateString(locale, { weekday: 'short' }),
    day: `${d}`,
  };
}

/**
 * "23 min" / "2h" / "hier" — the elapsed-time label in the post header.
 *
 * The prototype prints this bare after the word "in"/"dans"/"في", so this
 * returns the quantity only and the caller supplies the preposition.
 */
export function formatAgo(iso: Timestamp, lang: Lang = 'en', now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (lang === 'ar') {
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `${minutes} د`;
    if (hours < 24) return `${hours} س`;
    if (days === 1) return 'أمس';
    return `${days} ي`;
  }

  if (lang === 'en') {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return 'yesterday';
    return `${days}d`;
  }

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  if (hours < 24) return `${hours}h`;
  if (days === 1) return 'hier';
  return `${days}j`;
}
