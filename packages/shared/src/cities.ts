/**
 * The cities the platform covers, and how a mosque is assigned to one.
 *
 * **Nothing in the contract carries a city field.** A mosque belongs to
 * whichever centre it is nearest, computed from its coordinates — so adding a
 * city is adding a row here, not a migration over every mosque.
 *
 * This used to live only in the mobile app. It moved here when the super-admin
 * dashboard and campaign targeting needed the same answer: three
 * implementations of "which city is this mosque in" is three chances for the
 * dashboard's Montréal count to disagree with the app's Montréal list.
 *
 * Metro-level on purpose: Laval and Longueuil resolve to Montréal, because a
 * Montréal volunteer really does go to a Laval iftar.
 */

import type { Coordinates } from './types';

export interface CityCenter {
  id: string;
  name: string;
  center: Coordinates;
}

export const CITY_CENTERS: readonly CityCenter[] = [
  { id: 'montreal', name: 'Montréal', center: { lat: 45.5017, lng: -73.5673 } },
  { id: 'quebec', name: 'Québec', center: { lat: 46.8139, lng: -71.208 } },
  { id: 'ottawa', name: 'Ottawa', center: { lat: 45.4215, lng: -75.6972 } },
  { id: 'toronto', name: 'Toronto', center: { lat: 43.6532, lng: -79.3832 } },
];

export const DEFAULT_CITY_ID = 'montreal';

/** How far from a centre still counts as "in" that city. */
export const IN_CITY_KM = 60;

/** Great-circle distance, good enough for "which city is this". */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestCity(coords: Coordinates): { city: CityCenter; km: number } {
  let best = { city: CITY_CENTERS[0]!, km: Number.POSITIVE_INFINITY };
  for (const city of CITY_CENTERS) {
    const km = distanceKm(coords, city.center);
    if (km < best.km) best = { city, km };
  }
  return best;
}

/**
 * The city id someone at these coordinates is in, or null if they are nowhere
 * we cover — a traveller in Dubai should not be told they are in Toronto.
 */
export function cityIdAt(coords: Coordinates): string | null {
  const { city, km } = nearestCity(coords);
  return km <= IN_CITY_KM ? city.id : null;
}

/**
 * The city a mosque belongs to. Always resolves, unlike `cityIdAt` — every
 * mosque in the database is one we chose to list, so the nearest centre is the
 * right answer even for one an hour outside it.
 */
export function mosqueCityId(mosque: { coordinates: Coordinates }): string {
  return nearestCity(mosque.coordinates).city.id;
}

/** The display name for a city id. Falls back to the id, never to empty. */
export function cityNameById(id: string): string {
  return CITY_CENTERS.find((c) => c.id === id)?.name ?? id;
}
