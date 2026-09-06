/**
 * Cities. The app scopes what you see — mosques, events, requests — to one
 * city at a time: the one your phone says you're in, or one you chose to
 * browse. A mosque belongs to whichever centre it's nearest, so nothing in
 * the contract has to carry a city field.
 *
 * Metro-level on purpose: Laval and Longueuil resolve to Montréal, because a
 * Montréal volunteer really does go to a Laval iftar.
 *
 * **The centres and the maths live in `@m-ensemble/shared`.** The server needs
 * the same answer for the super-admin mosque table and for campaign targeting
 * by city, and two copies of these coordinates is two chances for the
 * dashboard's Montréal count to disagree with this list. What stays here is
 * the part only the app has: the Arabic names and the `Lang` lookup.
 */

import {
  CITY_CENTERS,
  DEFAULT_CITY_ID,
  cityIdAt,
  distanceKm as sharedDistanceKm,
  mosqueCityId,
} from '@m-ensemble/shared';
import type { Lang } from '@/i18n/strings';
import type { Coordinates, Mosque } from '@/types';

export interface City {
  id: string;
  name: string;
  nameAr: string;
  center: Coordinates;
}

/** Arabic names, keyed by the shared city id. */
const NAME_AR: Record<string, string> = {
  montreal: 'مونتريال',
  quebec: 'كيبيك',
  ottawa: 'أوتاوا',
  toronto: 'تورونتو',
};

export const CITIES: readonly City[] = CITY_CENTERS.map((c) => ({
  id: c.id,
  name: c.name,
  nameAr: NAME_AR[c.id] ?? c.name,
  center: c.center,
}));

export const DEFAULT_CITY: City = CITIES.find((c) => c.id === DEFAULT_CITY_ID) ?? CITIES[0]!;

export function cityById(id: string | null | undefined): City | null {
  return CITIES.find((c) => c.id === id) ?? null;
}

export function cityName(city: City, lang: Lang): string {
  return lang === 'ar' ? city.nameAr : city.name;
}

/** Great-circle distance, good enough for "which city is this". */
export const distanceKm = sharedDistanceKm;

/**
 * The city a person is standing in, or null if they're nowhere we cover —
 * a traveller in Dubai should not be told they're in Toronto.
 */
export function cityAt(coords: Coordinates): City | null {
  return cityById(cityIdAt(coords));
}

/** The city a mosque belongs to. Always resolves — every mosque lives somewhere. */
export function mosqueCity(mosque: Pick<Mosque, 'coordinates'>): City {
  return cityById(mosqueCityId(mosque)) ?? DEFAULT_CITY;
}
