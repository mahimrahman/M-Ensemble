import { z } from 'zod';

/**
 * `.strict()` so anything the app didn't mean to send is rejected rather than
 * silently written — `validate` merges the parsed result back over the body.
 */
export const patchMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    interests: z.array(z.string()).optional(),
    pushToken: z.string().optional(),
  })
  .strict();

/** Whole replace: all five booleans required, no partial updates. */
export const notificationPrefsSchema = z
  .object({
    volunteerRequests: z.boolean(),
    events: z.boolean(),
    classes: z.boolean(),
    announcements: z.boolean(),
    prayerReminders: z.boolean(),
  })
  .strict();

export const pushTokenSchema = z.object({ token: z.string().min(1) }).strict();

/**
 * `GET /users?ids=a,b,c`. `ids` is optional and an empty string yields `[]`,
 * not a 400 — the app builds the query with `ids.join(',')` and will happily
 * pass an empty array when a post has no signups yet.
 */
export const userIdsQuerySchema = z.object({
  ids: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 200),
    ),
});
