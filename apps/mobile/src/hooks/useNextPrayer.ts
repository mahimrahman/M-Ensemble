import { useMemo } from 'react';
import { api } from '@/api/client';
import { MOSQUE_TIMEZONE, dateStringIn, nextPrayerFrom, type NextPrayer } from '@/lib/prayer';
import type { ID, PrayerTable } from '@/types';
import { useApi } from './useApi';
import { useNow } from './useNow';

/**
 * Today's and tomorrow's tables for one mosque, and the next prayer out of
 * them re-evaluated every second. Both tables so the countdown rolls over to
 * tomorrow's fajr after isha instead of going blank.
 */
export function useNextPrayer(mosqueId: ID | null) {
  const now = useNow(1000);

  const tables = useApi<PrayerTable[]>(async () => {
    if (!mosqueId) return [];
    const at = new Date();
    return Promise.all([
      api.getPrayerTimes(mosqueId, dateStringIn(MOSQUE_TIMEZONE, at, 0)),
      api.getPrayerTimes(mosqueId, dateStringIn(MOSQUE_TIMEZONE, at, 1)),
    ]);
  }, [mosqueId]);

  const next: NextPrayer | null = useMemo(
    () => (tables.data ? nextPrayerFrom(tables.data, now) : null),
    [tables.data, now],
  );

  return { next, now, today: tables.data?.[0] ?? null, loading: tables.loading };
}
