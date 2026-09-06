import { z } from 'zod';
// Runtime values come through the server's shim, never straight from the
// package — see `src/shared.ts` for why a named import of one throws at boot.
import { SOCIAL_PLATFORMS } from '../shared.js';

const WALL_CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_STRING = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Deliberately **not** `.strict()`.
 *
 * The iqamah editor rebuilds its PUT body from rows this API handed it,
 * stripping only `mosqueId` — so anything else the server emits comes straight
 * back. `toJSON` already drops `_id`, and zod's default object strips unknown
 * keys rather than rejecting them. Belt and braces; `.strict()` here would turn
 * a harmless echo into a 400 on save.
 */
export const iqamahConfigSchema = z.object({
  iqamah: z.array(
    z.object({
      prayer: z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']),
      mode: z.enum(['fixed', 'offset']),
      fixedTime: z.string().regex(WALL_CLOCK).optional(),
      offsetMinutes: z.number().int().optional(),
      effectiveFrom: z.string().regex(DATE_STRING),
    }),
  ),
  jummah: z.array(
    z.object({
      label: z.string().min(1),
      khutbahTime: z.string().regex(WALL_CLOCK),
      iqamahTime: z.string().regex(WALL_CLOCK),
    }),
  ),
});

export const memberRoleSchema = z.object({ role: z.enum(['member', 'admin']) }).strict();

/**
 * What a coordinator may change about their own mosque's profile.
 *
 * `.strict()` on purpose, unlike the iqamah body above: name, address,
 * coordinates and joinCode are identity, and a typo'd client that sent one
 * should get a 400 rather than have it silently stripped. Empty strings are
 * allowed — that is how a field gets cleared.
 */
export const updateMosqueSchema = z
  .object({
    bio: z.string().max(2000).optional(),
    history: z.string().max(2000).optional(),
    website: z.string().max(200).optional(),
    phone: z.string().max(60).optional(),
    services: z.array(z.string().max(200)).max(20).optional(),
    // Handles or URLs, whichever the coordinator typed; the controller
    // normalizes. Every platform optional and an empty string clears one, so
    // the editor can send all seven fields on every save without inventing
    // links for the ones left blank.
    social: z
      .object(
        Object.fromEntries(
          SOCIAL_PLATFORMS.map((p) => [p, z.string().max(300).optional()]),
        ) as Record<(typeof SOCIAL_PLATFORMS)[number], z.ZodOptional<z.ZodString>>,
      )
      .strict()
      .optional(),
  })
  .strict();

/**
 * A coordinator's message to their followers.
 *
 * The caps are the shape of the surface it lands on, not arbitrary: the title
 * is one line on a notification card and in a push banner, the body a short
 * paragraph. Longer than this and the reader sees an ellipsis, so the limit
 * belongs where the writer can still do something about it.
 */
export const broadcastSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(600),
  })
  .strict();
