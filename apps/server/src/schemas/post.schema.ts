import { z } from 'zod';

const sessionSchema = z.object({ startAt: z.string(), endAt: z.string() }).strict();

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
};

export const createPostSchema = z
  .object({
    mosqueId: z.string().min(1),
    type: z.enum(['event', 'class', 'volunteer', 'announcement']),
    ...postFields,
  })
  .strict();

/**
 * `.strict()` is what makes this reject `type` and `mosqueId`. Both are fixed
 * at creation: moving a post between mosques would silently change who can
 * administer it, and changing its type would invalidate `slotsNeeded`.
 */
export const updatePostSchema = z
  .object(postFields)
  .partial()
  .strict();

export const checkInSchema = z.object({ userId: z.string().min(1) }).strict();
