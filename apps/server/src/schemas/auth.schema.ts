import { z } from 'zod';

/**
 * Password floor is **6**, not the 8 the phase-4 doc names.
 *
 * The signup screen is frozen and validates `password.length < 6`, so a 6- or
 * 7-character password passes the client and would come back as a 400 the app
 * has no branch for. Phase 5's rule is that shape mismatches get fixed on the
 * server, so the server takes what the client lets through.
 */
export const signupSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();
