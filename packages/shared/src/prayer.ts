/**
 * Prayer-time maths. `adhan` computes adhan from the mosque's coordinates and
 * `prayerConfig`; iqamah comes from the mosque's own config on top of that.
 *
 * This lives in the shared package so it has exactly two callers and one truth:
 * the mobile app renders it (PHASE 2) and `GET /mosques/:id/prayer-times`
 * returns it (PHASE 4). If the two ever disagree, one of them has stopped
 * importing this file.
 *
 * Wall-clock strings everywhere. A mosque prays at 20:30 by the clock on its
 * wall, whatever the UTC offset is that month.
 */

import {
  CalculationMethod,
  Coordinates,
  HighLatitudeRule,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from 'adhan';
import type {
  DateString,
  Iqamah,
  JummahSession,
  Mosque,
  Prayer,
  PrayerTable,
  PrayerTimeRow,
  WallClock,
} from './types';
import { PRAYERS } from './types';

/** Both demo mosques are in Montréal. The contract carries this per-table. */
export const MOSQUE_TIMEZONE = 'America/Toronto';

// -------------------------------------------------------------- wall clock ---

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function addMinutes(wallClock: WallClock, minutes: number): WallClock {
  const [h = '0', m = '0'] = wallClock.split(':');
  const total = (Number(h) * 60 + Number(m) + minutes + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Minutes east of UTC that `tz` observes at `at`. Falls back to the device's. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return -at.getTimezoneOffset();
  }
}

/** Formats an instant as the wall clock in `tz`. */
export function toWallClock(at: Date, tz: string = MOSQUE_TIMEZONE): WallClock {
  const offset = tzOffsetMinutes(tz, at);
  const shifted = new Date(at.getTime() + offset * 60000);
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
}

/** The instant at which `tz` reads `date` `time` on its wall. */
export function fromWallClock(date: DateString, time: WallClock, tz: string): Date {
  const [y = 0, mo = 1, d = 1] = date.split('-').map(Number);
  const [h = 0, mi = 0] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  // Offset at the guessed instant is right except in the DST switch hour,
  // which no iqamah lands in.
  return new Date(guess.getTime() - tzOffsetMinutes(tz, guess) * 60000);
}

/** `date` as "YYYY-MM-DD" in `tz`, `dayOffset` days later. */
export function dateStringIn(tz: string, at: Date = new Date(), dayOffset = 0): DateString {
  const offset = tzOffsetMinutes(tz, at);
  const shifted = new Date(at.getTime() + offset * 60000 + dayOffset * 86400000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

// ------------------------------------------------------------------ adhan ---

function parametersFor(mosque: Mosque): CalculationParameters {
  const { calculationMethod, madhab, highLatitudeRule } = mosque.prayerConfig;
  const params = CalculationMethod[calculationMethod]();
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  params.highLatitudeRule = HighLatitudeRule[highLatitudeRule];
  return params;
}

/** Adhan instants for the mosque on `date` (its local calendar day). */
export function adhanTimes(mosque: Mosque, date: DateString): Record<Prayer, Date> {
  const coords = new Coordinates(mosque.coordinates.lat, mosque.coordinates.lng);
  // adhan reads the local calendar fields of the Date it's given; noon on the
  // mosque's day keeps us clear of midnight on either side.
  const noon = fromWallClock(date, '12:00', MOSQUE_TIMEZONE);
  const times = new PrayerTimes(coords, noon, parametersFor(mosque));
  return {
    fajr: times.fajr,
    dhuhr: times.dhuhr,
    asr: times.asr,
    maghrib: times.maghrib,
    isha: times.isha,
  };
}

/**
 * Picks the iqamah config in force on `date` — the latest `effectiveFrom` that
 * isn't in the future — and resolves it against that day's adhan.
 */
export function resolveIqamah(
  configs: Iqamah[],
  mosqueId: string,
  prayer: Prayer,
  date: DateString,
  adhan: WallClock,
): WallClock | null {
  const applicable = configs
    .filter((i) => i.mosqueId === mosqueId && i.prayer === prayer && i.effectiveFrom <= date)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  const config = applicable[applicable.length - 1];
  if (!config) return null;
  if (config.mode === 'fixed') return config.fixedTime ?? null;
  return addMinutes(adhan, config.offsetMinutes ?? 0);
}

export function buildPrayerTable(
  mosque: Mosque,
  date: DateString,
  iqamah: Iqamah[],
  jummah: JummahSession[],
): PrayerTable {
  const adhan = adhanTimes(mosque, date);

  const rows: PrayerTimeRow[] = PRAYERS.map((prayer) => {
    const wall = toWallClock(adhan[prayer], MOSQUE_TIMEZONE);
    return { prayer, adhan: wall, iqamah: resolveIqamah(iqamah, mosque._id, prayer, date, wall) };
  });

  return {
    mosqueId: mosque._id,
    date,
    timezone: MOSQUE_TIMEZONE,
    rows,
    jummah: jummah.filter((j) => j.mosqueId === mosque._id),
  };
}
