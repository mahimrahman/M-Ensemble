/**
 * Account lifecycle — everything a real user needs beyond sign-up and sign-in.
 *
 * Password reset, email verification, sign-out that actually revokes the
 * token, deleting the account, and taking a copy of its data. All of it talks
 * to `/api/auth/*` and `/api/me/*`; none of it existed while the app was a demo.
 */

import type { ID, Timestamp } from './types';

// ─── Password reset ─────────────────────────────────────────────────────────

/** `POST /api/auth/forgot-password`. Always answers 200 — never confirms an email exists. */
export interface ForgotPasswordInput {
  email: string;
}

/** `POST /api/auth/reset-password`. The token arrives by email, single use, short-lived. */
export interface ResetPasswordInput {
  token: string;
  password: string;
}

/** `POST /api/auth/change-password`, signed in. Revokes every other session. */
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ─── Email verification ─────────────────────────────────────────────────────

/** `POST /api/auth/verify-email`. The token arrives by email. */
export interface VerifyEmailInput {
  token: string;
}

// ─── Deletion & export ──────────────────────────────────────────────────────

/**
 * `DELETE /api/me`. The password is required again: a stolen unlocked phone
 * must not be enough to erase somebody's account.
 */
export interface DeleteAccountInput {
  password: string;
}

/**
 * `GET /api/me/export` — everything we hold on one person, as JSON. Law 25
 * and PIPEDA both give people the right to this; the endpoint is how we answer
 * without a database query by hand.
 */
export interface AccountExport {
  exportedAt: Timestamp;
  user: {
    _id: ID;
    name: string;
    email: string;
    interests: string[];
    emailVerified: boolean;
    createdAt: Timestamp;
    lastLoginAt?: Timestamp;
  };
  notificationPrefs: Record<string, boolean>;
  memberships: { mosqueId: ID; role: string; createdAt: Timestamp }[];
  follows: { mosqueId: ID; createdAt: Timestamp }[];
  signups: {
    postId: ID;
    status: string;
    createdAt?: Timestamp;
    checkedInAt?: Timestamp;
    lateCancelledAt?: Timestamp;
    noShowAt?: Timestamp;
  }[];
  likes: { postId: ID; createdAt: Timestamp }[];
  notifications: { title: string; body: string; createdAt: Timestamp; readAt?: Timestamp }[];
  donations: { mosqueId: ID; amountCents: number; currency: string; createdAt: Timestamp }[];
}

// ─── Legal documents ────────────────────────────────────────────────────────

export type LegalDocumentKind = 'privacy' | 'terms';

export const LEGAL_DOCUMENTS: readonly LegalDocumentKind[] = ['privacy', 'terms'];

/**
 * `GET /api/legal/:kind?lang=fr|en`. Open, no token. The same text is served
 * as HTML at `/legal/:kind` for the store listings and the website, so the
 * app and the listing can never disagree.
 */
export interface LegalDocument {
  kind: LegalDocumentKind;
  lang: 'en' | 'fr';
  title: string;
  /** Markdown. The app renders headings and paragraphs; nothing fancier. */
  body: string;
  /** When this version took effect — shown at the top of the document. */
  effectiveAt: string;
  version: string;
}

// ─── Password policy ────────────────────────────────────────────────────────

/**
 * Eight characters, the floor NIST and both app stores' reviewers expect. The
 * sign-up and reset screens validate against this same constant so the client
 * never lets through something the server then refuses.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * The short list of passwords nobody should be allowed to pick. Compared in
 * lowercase. Small on purpose: a 10k-entry list belongs on the server; this is
 * what the client can reasonably check before the round trip.
 */
export const COMMON_PASSWORDS: readonly string[] = [
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'sunshine',
  'princess',
  'football',
  'baseball',
  'welcome1',
  'admin123',
  'letmein1',
  'mensemble',
  'mensemble1',
  'bismillah',
  'alhamdulillah',
];

/** Why a password was refused, or null when it is acceptable. */
export type PasswordProblem = 'too_short' | 'too_long' | 'too_common';

export function passwordProblem(password: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'too_short';
  if (password.length > PASSWORD_MAX_LENGTH) return 'too_long';
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) return 'too_common';
  return null;
}
