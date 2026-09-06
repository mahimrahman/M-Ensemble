/**
 * Runtime values from `@m-ensemble/shared`, re-exported for the server.
 *
 * **Why this file exists.** The server is `"type": "module"`; the shared package
 * deliberately is not, because Metro cannot resolve the `./types.js` specifiers
 * that ESM would force into `packages/shared/src/*` (it looks for a literal
 * `types.js` and finds `types.ts`). Marking shared as ESM breaks the mobile
 * bundle — verified with `expo export`, not assumed.
 *
 * That leaves shared as CJS, and a named import of a CJS module from ESM relies
 * on `cjs-module-lexer` statically detecting the exports. It cannot see through
 * the `export *` re-exports in shared's barrel, so
 * `import { MOCK_PASSWORD } from '@m-ensemble/shared'` throws at load. A
 * namespace import works, because that is a runtime property read.
 *
 * So: **runtime values come from here, types come straight from the package.**
 * `import type { Post } from '@m-ensemble/shared'` is fine anywhere — type
 * imports are erased and never hit the loader.
 */

import * as namespace from '@m-ensemble/shared';

/**
 * With nothing detected statically, Node puts the whole CJS `module.exports`
 * on `default` and leaves the namespace otherwise empty. Prefer `default` and
 * fall back to the namespace itself, so this keeps working unchanged if shared
 * ever becomes ESM. The cast is the point: TypeScript sees the real module
 * type, Node sees one `default` property.
 */
const shared = ((namespace as unknown as { default?: typeof namespace }).default ??
  namespace) as typeof namespace;

export const {
  // contract
  API_ERROR,
  PRAYERS,
  LATE_CANCEL_HOURS,
  // the platform tier — pricing, money maths, campaign rules
  STANDARD_PRICE_CENTS,
  INCLUDED_FEATURES,
  PLATFORM_ROLES,
  AD_PLACEMENTS,
  CAMPAIGN_TRANSITIONS,
  DEFAULT_CURRENCY,
  PLATFORM_FEE_BPS,
  standardPriceCents,
  platformFeeCents,
  monthlyValueCents,
  campaignSpentCents,
  formatMoney,
  // the mosque's pages elsewhere
  SOCIAL_PLATFORMS,
  SOCIAL_LABEL,
  normalizeSocial,
  socialLinks,
  // cities, resolved from coordinates rather than stored on the mosque
  CITY_CENTERS,
  cityIdAt,
  cityNameById,
  mosqueCityId,
  // prayer maths
  MOSQUE_TIMEZONE,
  addMinutes,
  tzOffsetMinutes,
  toWallClock,
  fromWallClock,
  dateStringIn,
  adhanTimes,
  resolveIqamah,
  buildPrayerTable,
  // fixtures — the seed and the test harness
  MOCK_PASSWORD,
  DEMO_COORDINATOR_EMAIL,
  DEMO_COORDINATOR_PASSWORD,
  passwordFor,
  CURRENT_USER_ID,
  KHADIJA_ADMIN_ID,
  KHADIJA_ID,
  MADINA_ADMIN_ID,
  MADINA_ID,
  SALAH_ADMIN_ID,
  SALAHOUDDINE_ID,
  CIIC_ADMIN_ID,
  CIIC_ID,
  VERDUN_ADMIN_ID,
  VERDUN_ID,
  FATIMA_ADMIN_ID,
  FATIMA_ID,
  RAWDAH_ID,
  LAVAL_ID,
  OTTAWA_ID,
  TORONTO_ID,
  // the coordinator allowlist — signup reads it, the seed writes from it
  COORDINATOR_EMAILS,
  coordinatorMosqueFor,
  defaultNotificationPrefs,
  mockFollows,
  mockIqamah,
  mockJummah,
  mockLikes,
  likeCountFor,
  mockMemberships,
  mockMosques,
  // curated ten + the generated directory — what the seed writes
  allMosques,
  directoryMosques,
  isOperatedMosque,
  mockPastPosts,
  mockPosts,
  mockSignups,
  mockUsers,
} = shared;
