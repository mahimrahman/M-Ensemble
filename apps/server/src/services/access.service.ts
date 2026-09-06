import { MembershipModel } from '../models/Membership.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';

/**
 * Permissions come from `Membership`, never from `Follow`. The two are separate
 * on purpose: following is public and drives the feed, a role drives what you
 * can do — and a coordinator need not follow the mosque they run.
 */
export async function isAdmin(userId: string, mosqueId: string): Promise<boolean> {
  const membership = await MembershipModel.exists({ userId, mosqueId, role: 'admin' });
  return membership !== null;
}

/**
 * Kept as a callable service rather than middleware-only because
 * `POST /posts/:id/checkin` needs it conditionally: a member may check
 * *themselves* in from the QR flow, anyone else needs the role.
 */
export async function assertAdmin(userId: string, mosqueId: string): Promise<void> {
  if (!(await isAdmin(userId, mosqueId))) {
    throw new HttpError(403, ERROR.FORBIDDEN, 'Only a coordinator of this mosque can do that.');
  }
}
