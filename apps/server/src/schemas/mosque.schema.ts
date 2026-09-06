import { z } from 'zod';

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
