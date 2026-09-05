/**
 * Cities. The app scopes what you see — mosques, events, requests — to one
 * city at a time: the one your phone says you're in, or one you chose to
 * browse. A mosque belongs to whichever centre it's nearest, so nothing in
 * the contract has to carry a city field.
 *
 * Metro-level on purpose: Laval and Longueuil resolve to Montréal, because a
 * Montréal volunteer really does go to a Laval iftar.
 */

import type { Lang } from '@/i18n/strings';
import type { Coordinates, Mosque } from '@/types';

export interface City {
  id: string;
  name: string;
  nameAr: string;
  center: Coordinates;
}

export const CITIES: readonly City[] = [
  { id: 'montreal', name: 'Montréal', nameAr: 'مونتريال', center: { lat: 45.5017, lng: -73.5673 } },
  { id: 'quebec', name: 'Québec', nameAr: 'كيبيك', center: { lat: 46.8139, lng: -71.208 } },
  { id: 'ottawa', name: 'Ottawa', nameAr: 'أوتاوا', center: { lat: 45.4215, lng: -75.6972 } },
  { id: 'toronto', name: 'Toronto', nameAr: 'تورونتو', center: { lat: 43.6532, lng: -79.3832 } },
];

export const DEFAULT_CITY: City = CITIES[0]!;

/** How far from a centre still counts as "in" that city. */
const IN_CITY_KM = 60;

export function cityById(id: string | null | undefined): City | null {
  return CITIES.find((c) => c.id === id) ?? null;
}

export function cityName(city: City, lang: Lang): string {
  return lang === 'ar' ? city.nameAr : city.name;
}

/** Great-circle distance, good enough for "which city is this". */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function nearest(coords: Coordinates): { city: City; km: number } {
  let best = { city: DEFAULT_CITY, km: Number.POSITIVE_INFINITY };
  for (const city of CITIES) {
    const km = distanceKm(coords, city.center);
    if (km < best.km) best = { city, km };
  }
  return best;
}

/**
 * The city a person is standing in, or null if they're nowhere we cover —
 * a traveller in Dubai should not be told they're in Toronto.
 */
export function cityAt(coords: Coordinates): City | null {
  const { city, km } = nearest(coords);
  return km <= IN_CITY_KM ? city : null;
}

/** The city a mosque belongs to. Always resolves — every mosque lives somewhere. */
export function mosqueCity(mosque: Pick<Mosque, 'coordinates'>): City {
  return nearest(mosque.coordinates).city;
}
