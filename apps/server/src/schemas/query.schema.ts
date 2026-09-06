import { z } from 'zod';

const POST_TYPES = ['event', 'class', 'volunteer', 'announcement'] as const;

/** `?types=volunteer,event` → `['volunteer','event']`. Empty means every type. */
const csvTypes = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter((t): t is (typeof POST_TYPES)[number] =>
        (POST_TYPES as readonly string[]).includes(t),
      ),
  );

const csvIds = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );

/** `GET /feed?types=a,b&mosques=x,y` — note `mosques`, not `mosqueIds`. */
export const feedQuerySchema = z.object({
  types: csvTypes,
  mosques: csvIds,
});

/**
 * `GET /mosques/:id/roster?upcoming=true&types=a,b&post=id` — note `post`,
 * singular, not `postId`. Both names come from `http.ts` and are not ours to
 * tidy up.
 */
export const rosterQuerySchema = z.object({
  upcoming: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  types: csvTypes,
  post: z.string().optional(),
});

export const mosquePostsQuerySchema = z.object({
  all: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export const prayerTimesQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});
