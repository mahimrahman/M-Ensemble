import { api } from '@/api/client';
import type { ID, PrayerTable } from '@/types';
import { useApi, type ApiState } from './useApi';

/** "2026-09" → the "YYYY-MM-DD" strings of every day that month. */
export function daysOfMonth(year: number, month: number): string[] {
  const count = new Date(year, month, 0).getDate();
  const mm = `${month}`.padStart(2, '0');
  return Array.from({ length: count }, (_, i) => `${year}-${mm}-${`${i + 1}`.padStart(2, '0')}`);
}

/**
 * A whole month of tables for one mosque. Built from the per-day contract
 * call rather than a new endpoint, so mocks and the real server both serve
 * it unchanged — the mock computes locally, the server takes ~30 requests
 * in parallel, which is fine for a screen you open a few times a month.
 */
export function usePrayerMonth(
  mosqueId: ID | null,
  year: number,
  month: number,
): ApiState<PrayerTable[]> {
  return useApi<PrayerTable[]>(async () => {
    if (!mosqueId) return [];
    return Promise.all(daysOfMonth(year, month).map((date) => api.getPrayerTimes(mosqueId, date)));
  }, [mosqueId, year, month]);
}
