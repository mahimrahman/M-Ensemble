import type { Request } from 'express';
import type { AuditEntry, AuditTargetType, PageQuery, PageResult } from '@m-ensemble/shared';
import { AuditEntryModel } from '../models/AuditEntry.js';
import { asContract } from '../utils/serialize.js';
import { newId } from '../utils/ids.js';
import { pageResult, resolvePage, searchRegex, sortSpec } from '../utils/paging.js';
import type { UserDocument } from '../models/User.js';

/**
 * The platform's append-only record of who did what.
 *
 * Only two functions exist on purpose: `record` and `list`. There is no update
 * and no delete, because a log an operator can edit answers no question anyone
 * would ask it.
 *
 * **`record` never throws into the request.** An audit write failing must not
 * fail the action it was describing — the money moved, and losing the log line
 * is strictly better than a 500 that leaves the caller unsure whether it did.
 * The failure is logged loudly instead.
 */
export interface AuditInput {
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  summary: string;
  meta?: Record<string, unknown>;
}

export async function record(
  actor: Pick<UserDocument, '_id' | 'name'>,
  input: AuditInput,
  req?: Request,
): Promise<void> {
  try {
    await AuditEntryModel.create({
      _id: newId(),
      actorId: actor._id,
      actorName: actor.name,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      summary: input.summary,
      meta: input.meta,
      ip: req ? clientIp(req) : undefined,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[audit] failed to record', input.action, err);
  }
}

/**
 * The caller's address, preferring the proxy header when Express has been told
 * to trust one. `req.ip` alone is the load balancer in every deployment that
 * has one, which makes the field decorative.
 */
function clientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (first ?? req.ip)?.trim() || undefined;
}

export interface AuditQuery extends PageQuery {
  actorId?: string;
  targetType?: AuditTargetType;
  targetId?: string;
  action?: string;
}

const SORTABLE = ['createdAt', 'action', 'actorName'] as const;

export async function list(query: AuditQuery): Promise<PageResult<AuditEntry>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};

  if (query.actorId) filter.actorId = query.actorId;
  if (query.targetType) filter.targetType = query.targetType;
  if (query.targetId) filter.targetId = query.targetId;
  if (query.action) filter.action = query.action;

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ summary: rx }, { action: rx }, { actorName: rx }];

  const [rows, total] = await Promise.all([
    AuditEntryModel.find(filter)
      .sort(sortSpec(query, SORTABLE, { createdAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    AuditEntryModel.countDocuments(filter),
  ]);

  return pageResult(
    rows.map((r) => asContract<AuditEntry>(r)),
    total,
    resolved,
  );
}
