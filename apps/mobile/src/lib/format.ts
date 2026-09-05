/** Shared formatting so two screens never disagree about how a date reads. */

import type { Lang } from '@/i18n/strings';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The BCP-47 tag each app language formats dates in. */
const LOCALE: Record<Lang, string> = { fr: 'fr-CA', en: 'en-CA', ar: 'ar' };

const RELATIVE: Record<Lang, { today: string; tomorrow: string; yesterday: string }> = {
  fr: { today: "Aujourd'hui", tomorrow: 'Demain', yesterday: 'Hier' },
  en: { today: 'Today', tomorrow: 'Tomorrow', yesterday: 'Yesterday' },
  ar: { today: 'اليوم', tomorrow: 'غداً', yesterday: 'أمس' },
};

function startOfDay(d: Date): number {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** "Today", "Tomorrow", "Sat 12 Sep" — relative where it helps, absolute after. */
export function formatDay(iso: string, lang: Lang = 'en'): string {
  const date = new Date(iso);
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / DAY_MS);
  const locale = LOCALE[lang];

  if (days === 0) return RELATIVE[lang].today;
  if (days === 1) return RELATIVE[lang].tomorrow;
  if (days === -1) return RELATIVE[lang].yesterday;
  if (days > 1 && days < 7) return date.toLocaleDateString(locale, { weekday: 'long' });
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * "17:00". Forced to 24-hour in every language — the prototype prints mono
 * 24-hour times throughout, and a prayer table with am/pm reads wrong.
 */
export function formatTime(iso: string, lang: Lang = 'en'): string {
  return new Date(iso).toLocaleTimeString(LOCALE[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
}

/** "Samedi · 17:00–19:30" */
export function formatWhen(startAt: string, endAt: string, lang: Lang = 'en'): string {
  return `${formatDay(startAt, lang)} · ${formatTime(startAt, lang)}–${formatTime(endAt, lang)}`;
}

/** "2h 30m" — how service hours read in My Stuff. */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Hours as a single decimal — "6.5", the figure the prototype shows. */
export function formatHours(totalMinutes: number): string {
  const hours = totalMinutes / 60;
  return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
}

/** Today as "YYYY-MM-DD" in local time — the shape `getPrayerTimes` expects. */
export function todayDateString(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
