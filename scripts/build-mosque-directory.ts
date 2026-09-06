/**
 * Turn `database.json` into `packages/shared/src/directory.ts`.
 *
 *   npx tsx scripts/build-mosque-directory.ts
 *
 * The database is a research dump: one row per mosque, with the programs and
 * the fees written as long prose in two fields. The app needs `Mosque` shapes —
 * coordinates, a bio, a services list. This script does that conversion once,
 * at build time, so the runtime never parses prose and the output can be read
 * in a diff before it ships.
 *
 * **The ten hand-written mosques in `fixtures.ts` win.** They carry prose
 * nobody would generate, and they are the ones the demo actually walks
 * through. This script matches on street address and skips them, so re-running
 * it can never overwrite that writing.
 *
 * Everything emitted here is browsable-but-not-operated: real name, address,
 * coordinates, phone, website, rating and services, with no posts, no
 * coordinator and no iqamah config. That is the honest shape — we hold public
 * directory data for these mosques, not an account they have claimed.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockMosques } from '../packages/shared/src/fixtures';
import type { Mosque } from '../packages/shared/src/types';

const ROOT = join(import.meta.dirname, '..');

interface Row {
  Name: string;
  Address: string;
  Latitude: string;
  Longitude: string;
  Phone?: string;
  'Rating (#)'?: string;
  Website?: string;
  'Programs / Classes / Events'?: string;
  'Pricing (verified where stated)'?: string;
  Notes?: string;
}

/** Sections that resolve to a city the app covers. */
const SECTIONS = [
  'Montreal (Island)',
  'Greater Montreal',
  'Toronto',
  'Ottawa',
  'Quebec City',
] as const;

const db = JSON.parse(readFileSync(join(ROOT, 'database.json'), 'utf8')) as Record<string, Row[]>;

// ---------------------------------------------------------------- helpers ---

const squash = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The street line — "2385 Rue Centre" out of the full civic address. */
const street = (address: string): string => String(address).split(',')[0]!.trim();

/**
 * A stable id from the name. Ids end up in URLs and QR deep links, so they must
 * survive a re-run: derived from the name only, never from array position.
 */
function idFor(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .split('_')
    .slice(0, 4)
    .join('_');
  return `mosque_${slug}`;
}

/** Join codes are what a coordinator types to claim a mosque. Unique, short. */
function joinCodeFor(name: string, taken: Set<string>): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  let code = base || 'MASJID';
  let n = 2;
  while (taken.has(code)) code = `${base.slice(0, 5)}${n++}`;
  taken.add(code);
  return code;
}

/** "4.7 (230)" → { score: 4.7, count: 230 }. Absent or unparseable → undefined. */
function parseRating(raw: string | undefined): Mosque['rating'] {
  const m = /([\d.]+)\s*\((\d[\d,]*)\)/.exec(raw ?? '');
  if (!m) return undefined;
  return { score: Number(m[1]), count: Number(m[2]!.replace(/,/g, '')) };
}

/** The first phone when the row lists several separated by "/". */
function parsePhone(raw: string | undefined): string | undefined {
  const first = (raw ?? '').split('/')[0]?.trim();
  return first && /\d/.test(first) ? first : undefined;
}

/** Bare host — the UI adds the scheme. */
function parseWebsite(raw: string | undefined): string | undefined {
  const host = (raw ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  return host && host.includes('.') ? host : undefined;
}

/**
 * Split the programs prose into services.
 *
 * The field is written as sentences with ALL-CAPS headings ("WEEKEND SCHOOL:
 * Quran + Arabic for ~300 children"). Sentence boundaries are the reliable
 * split; the heading, when there is one, is the readable half. Anything that
 * survives as a fragment is dropped rather than shown half-formed.
 */
function parseServices(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];

  // Protect the abbreviations that end in a period before splitting on
  // sentences — "(est. 1965)" and "approx. 12:00 PM" would otherwise break in
  // half and surface as "Oldest Islamic institution in Quebec (est".
  const DOT = String.fromCharCode(1); // stands in for a period that must not split
  const ABBREV = /\b(est|approx|apx|vs|etc|ave|blvd|min|hrs?|yrs?|wks?)\.(\s)/gi;
  const guarded = raw.replace(ABBREV, (_m, w, sp) => w + DOT + sp);
  for (const piece of guarded.split(/(?<=[.;])\s+(?=[A-Z0-9])/)) {
    let s = piece.split(DOT).join('.').trim().replace(/[.;]+$/, '');

    // "WEEKEND SCHOOL: Quran + Arabic for 300 children" → keep both halves but
    // sentence-case the shouted heading so it sits in a list.
    const heading = /^([A-Z][A-Z'&\-\s/()0-9]{3,}?):\s*(.+)$/.exec(s);
    if (heading) {
      const label = titleCase(heading[1]!.trim());
      const rest = heading[2]!.trim();
      s = rest.length > 4 ? `${label} — ${clip(rest, 90)}` : label;
    } else {
      s = clip(s, 110);
    }

    // Leading connectives read as fragments once the sentence around them is gone.
    s = s.replace(/^(Also|And|Plus|Historically also)[:,]?\s*/i, '');

    // The source shouts for emphasis mid-sentence ("held FRIDAY THROUGH MONDAY",
    // "THREE Jumu'ah prayers"). Calm anything of three-plus letters that isn't a
    // known initialism, so a list of programmes doesn't read as a list of alarms.
    const KEEP_CAPS = /^(MAC|ICNA|CIIC|AICP|ISNA|QC|ON|BBQ|AM|PM|II|III|IV)$/;
    s = s.replace(/\b[A-Z]{3,}(?:\s+[A-Z]{2,})*\b/g, (shout) =>
      shout.split(/\s+/).every((w) => KEEP_CAPS.test(w)) ? shout : titleCase(shout),
    );

    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (s.length >= 8) out.push(s);
    if (out.length === 8) break;
  }
  return out;
}

/** Cut on a word boundary, with an ellipsis only when something was lost. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]$/, '')}…`;
}

function titleCase(s: string): string {
  const small = new Set(['and', 'of', 'the', 'for', 'to', 'in', 'at', 'a', 'de', 'du', 'la']);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/**
 * A one-paragraph bio.
 *
 * We do not invent history for a mosque we have not spoken to — the ten in
 * `fixtures.ts` have a `history` because someone wrote it. Here the bio states
 * only what the row actually supports: where it is, and what it runs.
 */
function buildBio(row: Row, services: string[]): string | undefined {
  const where = /,\s*([^,]+),\s*(?:QC|ON)\b/.exec(row.Address);
  const borough = (where?.[1] ?? '').trim();
  // "On Rue Workman in Saint-Henri" — the borough only when it adds something
  // the street line doesn't already say.
  const place =
    borough && borough !== 'Montréal'
      ? `On ${street(row.Address)} in ${borough}`
      : `On ${street(row.Address)}`;

  // The row's own note is the most specific sentence we have; lead with it.
  const notes = row.Notes?.trim().replace(/[.;]+$/, '');
  const lead = notes ? `${notes}. ` : '';

  // No "Runs x, y and z" sentence. Every attempt at one reads like a machine
  // stitched it — "Runs main hall seats 1,000", "Runs oldest Islamic
  // institution in Quebec (est." — because these fragments are headings, not
  // predicates. The services list right below the bio already says all of it,
  // properly formatted. The bio says where the mosque is and what its own note
  // says about it, and stops there.
  return `${lead}${place}.`;
}

// ------------------------------------------------------------------ build ---

/** Street lines of the curated ten — matched on so we never shadow them. */
const curated = new Set(mockMosques.map((m) => squash(street(m.address))));
const takenCodes = new Set(mockMosques.map((m) => m.joinCode));
const seenIds = new Set(mockMosques.map((m) => m._id));

const entries: Mosque[] = [];
let skipped = 0;

for (const section of SECTIONS) {
  for (const row of db[section] ?? []) {
    if (!row.Name || !row.Latitude || !row.Longitude) continue;

    if (curated.has(squash(street(row.Address)))) {
      skipped++;
      continue;
    }

    let id = idFor(row.Name);
    if (seenIds.has(id)) id = `${id}_${squash(street(row.Address)).slice(0, 6)}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const services = parseServices(row['Programs / Classes / Events']);

    entries.push({
      _id: id,
      // The parenthetical is an alternate name, not part of the sign outside.
      name: row.Name.replace(/\s*\(.*?\)\s*$/, '').trim(),
      address: row.Address.trim(),
      coordinates: { lat: Number(row.Latitude), lng: Number(row.Longitude) },
      joinCode: joinCodeFor(row.Name, takenCodes),
      prayerConfig: {
        calculationMethod: 'NorthAmerica',
        madhab: 'shafi',
        highLatitudeRule: 'TwilightAngle',
      },
      ...(parsePhone(row.Phone) ? { phone: parsePhone(row.Phone) } : {}),
      ...(parseWebsite(row.Website) ? { website: parseWebsite(row.Website) } : {}),
      ...(parseRating(row['Rating (#)']) ? { rating: parseRating(row['Rating (#)']) } : {}),
      ...(buildBio(row, services) ? { bio: buildBio(row, services) } : {}),
      ...(services.length ? { services } : {}),
    });
  }
}

entries.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

const file = `/**
 * The mosque directory — GENERATED, do not edit by hand.
 *
 *   npx tsx scripts/build-mosque-directory.ts
 *
 * Source: \`database.json\` at the repo root. These are mosques we hold public
 * directory data for: address, coordinates, contact, rating and the programs
 * they publish. Nobody has claimed them in the app, so they carry no posts, no
 * coordinator and no iqamah times — the profile screen says so rather than
 * rendering an empty prayer table.
 *
 * The ten mosques in \`fixtures.ts\` are hand-written and deliberately absent
 * here; the generator skips them on street address so a re-run cannot
 * overwrite that prose.
 */

import type { Mosque } from './types';

/** ${entries.length} mosques, alphabetical. Real data, unclaimed accounts. */
export const directoryMosques: Mosque[] = ${JSON.stringify(entries, null, 2)};

/** Directory ids, for the "is this mosque claimed?" check the UI makes. */
export const directoryMosqueIds: ReadonlySet<string> = new Set(
  directoryMosques.map((m) => m._id),
);
`;

writeFileSync(join(ROOT, 'packages/shared/src/directory.ts'), file, 'utf8');

console.log(`directory: ${entries.length} mosques written`);
console.log(`  skipped ${skipped} already hand-written in fixtures.ts`);
console.log(`  with services: ${entries.filter((m) => m.services?.length).length}`);
console.log(`  with rating:   ${entries.filter((m) => m.rating).length}`);
console.log(`  with website:  ${entries.filter((m) => m.website).length}`);
