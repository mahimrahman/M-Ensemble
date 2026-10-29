import { z } from 'zod';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblem } from '../shared.js';

const PROBLEM_MESSAGE = {
  too_short: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  too_long: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
  too_common: 'That password is too easy to guess. Pick something less common.',
} as const;

/**
 * A password someone is *choosing* — signup, reset, change. The sign-in and
 * delete paths take whatever was set before, because a stored password that
 * predates the policy still has to open the account; only the next choice is
 * held to it. Same rule as `passwordProblem` on the client, so the app never
 * lets through something this refuses.
 */
export const newPasswordSchema = z.string().superRefine((password, ctx) => {
  const problem = passwordProblem(password);
  if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: PROBLEM_MESSAGE[problem] });
});

const emailSchema = z.string().trim().toLowerCase().email();

export const signupSchema = z
  .object({
    email: emailSchema,
    password: newPasswordSchema,
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: newPasswordSchema,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: newPasswordSchema,
  })
  .strict();

export const verifyEmailSchema = z.object({ token: z.string().min(1) }).strict();

export const deleteAccountSchema = z.object({ password: z.string().min(1) }).strict();
