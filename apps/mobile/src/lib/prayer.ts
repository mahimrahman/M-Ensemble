/**
 * Prayer times, app side.
 *
 * The maths moved to `packages/shared/src/prayer.ts` in PHASE 4 so that
 * `GET /mosques/:id/prayer-times` and this app compute the identical table from
 * the identical code. It is re-exported here so no screen import changed.
 *
 * What stays in the app is the half that only a UI needs: the prayer names, and
 * reading a `PrayerTable` back into instants for the countdown. `nextPrayerFrom`
 * knows only the API shape, so it survives PHASE 5 untouched.
 */

export {
  MOSQUE_TIMEZONE,
  addMinutes,
  tzOffsetMinutes,
  toWallClock,
  fromWallClock,
  dateStringIn,
  adhanTimes,
  resolveIqamah,
  buildPrayerTable,
} from '@m-ensemble/shared';

import { fromWallClock } from '@m-ensemble/shared';
import type { DateString, Prayer, PrayerTable } from '@/types';

export const PRAYER_LABEL: Record<Prayer, string> = {
  fajr: 'Fajr',
  dhuhr: 'Dhuhr',
  asr: 'Asr',
  maghrib: 'Maghrib',
  isha: 'Isha',
};

/** The Arabic names, as the prototype prints them. */
export const PRAYER_LABEL_AR: Record<Prayer, string> = {
  fajr: 'الفجر',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
};

/**
 * Prayer names transliterate identically in French and English, so only Arabic
 * differs. They live here rather than in the string table because the five
 * names are domain data, not copy.
 */
export function prayerLabel(prayer: Prayer, lang: string): string {
  return lang === 'ar' ? PRAYER_LABEL_AR[prayer] : PRAYER_LABEL[prayer];
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

// -------------------------------------------------------------- countdown ---

export interface NextPrayer {
  prayer: Prayer;
  /** The table it came from — today's or tomorrow's. */
  date: DateString;
  adhanAt: Date;
  iqamahAt: Date | null;
  /** What the countdown targets: iqamah when configured, adhan otherwise. */
  at: Date;
}

/**
 * The first prayer in `tables` (today, then tomorrow) whose target instant is
 * still ahead of `now`. Returns null only if both tables are behind us.
 */
export function nextPrayerFrom(tables: PrayerTable[], now: Date = new Date()): NextPrayer | null {
  for (const table of tables) {
    for (const row of table.rows) {
      const adhanAt = fromWallClock(table.date, row.adhan, table.timezone);
      const iqamahAt = row.iqamah ? fromWallClock(table.date, row.iqamah, table.timezone) : null;
      const at = iqamahAt ?? adhanAt;
      if (at.getTime() > now.getTime()) {
        return { prayer: row.prayer, date: table.date, adhanAt, iqamahAt, at };
      }
    }
  }
  return null;
}

/** "1h 12m" / "4m 09s" — tightens up as the moment approaches. */
export function formatCountdown(target: Date, now: Date = new Date()): string {
  const total = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${pad(m)}m`;
  return `${m}m ${pad(s)}s`;
}
