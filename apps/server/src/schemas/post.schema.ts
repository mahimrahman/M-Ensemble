import { z } from 'zod';

const sessionSchema = z.object({ startAt: z.string(), endAt: z.string() }).strict();

/**
 * A poster, named by the path `POST /uploads/poster` handed back.
 *
 * **Only our own uploads, never an arbitrary URL.** `imageUrl` is rendered by
 * every client that shows the post, so a free-form string would let one admin
 * point every reader's app at any host on the internet — a tracking pixel that
 * collects the IP of everyone who scrolls past, at minimum. Constraining it to
 * a path this server itself minted removes the question: the only way to fill
 * this field is to upload a file through the endpoint that checks you
 * administer the mosque.
 *
 * The shape is exactly what `storePoster` writes — `/uploads/<uuid>.jpg`.
 */
const POSTER_PATH =
  /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

const posterUrl = z
  .string()
  .regex(POSTER_PATH, 'imageUrl must be a path returned by POST /uploads/poster');

const postFields = {
  title: z.string().trim().min(1),
  description: z.string(),
  category: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  location: z.string(),
  slotsNeeded: z.number().int().positive().optional(),
  capacity: z.number().int().positive().optional(),
  sessions: z.array(sessionSchema).optional(),
  imageUrl: posterUrl.optional(),
};

/** A post that ends before (or exactly when) it starts is never valid. */
const endsAfterStart = (p: { startAt?: string; endAt?: string }): boolean =>
  !p.startAt || !p.endAt || new Date(p.endAt).getTime() > new Date(p.startAt).getTime();

const END_BEFORE_START = { message: 'endAt must be after startAt', path: ['endAt'] };

export const createPostSchema = z
  .object({
    mosqueId: z.string().min(1),
    type: z.enum(['event', 'class', 'volunteer', 'announcement']),
    ...postFields,
  })
  .strict()
  .refine(endsAfterStart, END_BEFORE_START);

/**
 * `.strict()` is what makes this reject `type` and `mosqueId`. Both are fixed
 * at creation: moving a post between mosques would silently change who can
 * administer it, and changing its type would invalidate `slotsNeeded`.
 */
export const updatePostSchema = z
  .object(postFields)
  .partial()
  // `null` is how the form says "take the poster off", which is a different
  // request from the `undefined` that every untouched field sends. Only the
  // patch shape needs it: there is nothing to remove at creation.
  .extend({ imageUrl: posterUrl.nullable().optional() })
  .strict()
  // Only checkable when the patch carries both ends; a lone `endAt` is
  // checked against the stored `startAt` in the controller.
  .refine(endsAfterStart, END_BEFORE_START);

export const checkInSchema = z.object({ userId: z.string().min(1) }).strict();
