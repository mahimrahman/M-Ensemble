import type { RequestHandler } from 'express';
import type { PlatformRole } from '@m-ensemble/shared';
import { asyncHandler } from '../utils/asyncHandler.js';
import { currentUser } from './requireAuth.js';
import { HttpError } from './errorHandler.js';
import { ERROR } from '../utils/errors.js';

/**
 * The platform tier's guard — the counterpart to `requireAdmin`, which asks
 * "are you a coordinator of *this mosque*". This one asks "do you operate the
 * platform", and takes no mosque at all, because the answer is the same
 * everywhere.
 *
 * **The two never substitute for each other.** A coordinator holding
 * `Membership.role === 'admin'` at six mosques still has `platformRole: 'none'`
 * and gets a 403 from every route below this. That is the whole point of the
 * split: mosque admin is granted by us, platform admin is us.
 */

/** Rank, so `atLeast` is a comparison rather than a list of enums per route. */
const RANK: Record<PlatformRole, number> = { none: 0, support: 1, superadmin: 2 };

function requirePlatformRole(minimum: PlatformRole): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const user = currentUser(req);
    if (RANK[user.platformRole] < RANK[minimum]) {
      // Same 403 and the same sentence whichever tier was missing. A message
      // that named the role would tell an ordinary member that a platform tier
      // exists and what it is called, which is not something they need to know.
      throw new HttpError(403, ERROR.FORBIDDEN, 'You do not have access to that.');
    }
    next();
  });
}

/**
 * Read the platform: overview, tables, one mosque's detail, the audit log.
 *
 * `support` clears this. Someone answering the inbox needs to see a user's
 * mosques and a mosque's invoices to make sense of a ticket, and locking that
 * behind `superadmin` would only mean every question becomes an interruption.
 */
export const requirePlatform = requirePlatformRole('support');

/**
 * Change the platform: issue credentials, move money, approve a campaign,
 * grant a role, publish on a mosque's behalf.
 *
 * `superadmin` only. The split exists so a volunteer answering support is not
 * one misclick from voiding an invoice — see `PlatformRole` in the contract.
 */
export const requireSuperAdmin = requirePlatformRole('superadmin');

/** True when this request may take a destructive platform action. */
export function isSuperAdmin(req: Parameters<typeof currentUser>[0]): boolean {
  return req.user?.platformRole === 'superadmin';
}
