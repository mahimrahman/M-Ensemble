import type { Request } from 'express';
import type {
  AddTicketMessageInput,
  CreateTicketInput,
  PageQuery,
  PageResult,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UpdateTicketInput,
} from '@m-ensemble/shared';
import { SupportTicketModel } from '../models/SupportTicket.js';
import { UserModel, type UserDocument } from '../models/User.js';
import { nextSequence } from '../models/Counter.js';
import * as audit from './audit.service.js';
import { HttpError } from '../middleware/errorHandler.js';
import { ERROR } from '../utils/errors.js';
import { newId } from '../utils/ids.js';
import { asContract } from '../utils/serialize.js';
import { pageResult, resolvePage, searchRegex, sortSpec } from '../utils/paging.js';

/**
 * The support inbox — "solve user issues" with somewhere for the issue to live.
 *
 * A ticket can be opened by the person with the problem (from the app) or by
 * whoever they cornered after Jummah (from the dashboard). Both land in the
 * same collection, and the second case is why `userId` is optional: a phone
 * call about a login that will not work is a real ticket even though the person
 * could not sign in to file it.
 */

/** `TKT-1043`. Short, ordered and unique, because it gets read down a phone. */
async function mintReference(): Promise<string> {
  const seq = await nextSequence('ticket');
  return `TKT-${1000 + seq}`;
}

const SORTABLE = ['createdAt', 'updatedAt', 'priority', 'status'] as const;

export interface TicketQuery extends PageQuery {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assignedTo?: string;
  mosqueId?: string;
  /** Everything not yet resolved or closed — what the inbox opens on. */
  openOnly?: boolean;
}

export async function listTickets(query: TicketQuery): Promise<PageResult<SupportTicket>> {
  const resolved = resolvePage(query);
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.openOnly) filter.status = { $in: ['open', 'pending'] };
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.mosqueId) filter.mosqueId = query.mosqueId;

  const rx = searchRegex(query.q);
  if (rx) filter.$or = [{ subject: rx }, { reference: rx }, { userEmail: rx }, { userName: rx }];

  const [rows, total] = await Promise.all([
    SupportTicketModel.find(filter)
      .sort(sortSpec(query, SORTABLE, { updatedAt: -1 }))
      .skip(resolved.skip)
      .limit(resolved.limit),
    SupportTicketModel.countDocuments(filter),
  ]);

  return pageResult(
    rows.map((r) => asContract<SupportTicket>(r)),
    total,
    resolved,
  );
}

export async function getTicket(id: string): Promise<SupportTicket> {
  const doc = await SupportTicketModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such ticket.');
  return asContract<SupportTicket>(doc);
}

/**
 * Open a ticket. `author` is whoever is filing it — the reporter when this came
 * from the app, a staff member when it came from a phone call.
 */
export async function createTicket(
  input: CreateTicketInput,
  author: UserDocument,
  req?: Request,
): Promise<SupportTicket> {
  // The reporter's name and email are copied onto the ticket rather than
  // joined on read, so the inbox still says who reported something after the
  // account is deleted — which is exactly the case a support record is kept for.
  const reporter = input.userId ? await UserModel.findById(input.userId) : author;
  const fromStaff = author.platformRole !== 'none' && author._id !== input.userId;
  const now = new Date();

  const doc = await SupportTicketModel.create({
    _id: newId(),
    reference: await mintReference(),
    subject: input.subject.trim(),
    category: input.category ?? 'other',
    status: 'open',
    priority: input.priority ?? 'normal',
    userId: reporter?._id,
    userName: reporter?.name,
    userEmail: reporter?.email,
    mosqueId: input.mosqueId,
    messages: [
      {
        _id: newId(),
        authorId: author._id,
        authorName: author.name,
        fromStaff,
        body: input.body,
        internal: false,
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  });

  await audit.record(
    author,
    {
      action: 'ticket.created',
      targetType: 'ticket',
      targetId: doc._id,
      summary: `Opened ${doc.reference}: ${doc.subject}`,
      meta: { userId: reporter?._id, mosqueId: input.mosqueId },
    },
    req,
  );
  return asContract<SupportTicket>(doc);
}

export async function updateTicket(
  id: string,
  patch: UpdateTicketInput,
  actor: UserDocument,
  req?: Request,
): Promise<SupportTicket> {
  const doc = await SupportTicketModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such ticket.');

  const before = doc.status;
  if (patch.subject !== undefined) doc.subject = patch.subject.trim();
  if (patch.category !== undefined) doc.category = patch.category;
  if (patch.priority !== undefined) doc.priority = patch.priority;

  if (patch.assignedTo !== undefined) {
    doc.assignedTo = patch.assignedTo || undefined;
    const assignee = patch.assignedTo ? await UserModel.findById(patch.assignedTo) : null;
    doc.assignedToName = assignee?.name;
  }

  if (patch.status !== undefined) {
    doc.status = patch.status;
    if (patch.status === 'resolved' || patch.status === 'closed') {
      // Stamped once, on the first resolution. Reopening and re-resolving
      // should not restart the clock — the honest answer to "how long did this
      // take" is measured from when the person first asked.
      doc.resolvedAt = doc.resolvedAt ?? new Date();
      doc.resolutionHours =
        doc.resolutionHours ??
        Math.round(((doc.resolvedAt.getTime() - doc.createdAt.getTime()) / 3_600_000) * 10) / 10;
    }
  }

  doc.updatedAt = new Date();
  await doc.save();

  await audit.record(
    actor,
    {
      action: 'ticket.updated',
      targetType: 'ticket',
      targetId: doc._id,
      summary:
        patch.status && patch.status !== before
          ? `${doc.reference}: ${before} → ${patch.status}`
          : `Updated ${doc.reference}`,
      meta: { fields: Object.keys(patch) },
    },
    req,
  );
  return asContract<SupportTicket>(doc);
}

/**
 * Reply on a ticket, or leave an internal note.
 *
 * A staff reply moves an `open` ticket to `pending` — the ball is with the
 * reporter now, and an inbox that cannot tell those apart is one where
 * everything answered still looks unanswered. An **internal** note never moves
 * the status, because nobody outside the team has seen it.
 */
export async function addMessage(
  id: string,
  input: AddTicketMessageInput,
  author: UserDocument,
  req?: Request,
): Promise<SupportTicket> {
  const doc = await SupportTicketModel.findById(id);
  if (!doc) throw new HttpError(404, ERROR.NOT_FOUND, 'No such ticket.');

  const fromStaff = author.platformRole !== 'none';
  const internal = Boolean(input.internal);

  if (internal && !fromStaff) {
    throw new HttpError(403, ERROR.FORBIDDEN, 'Only staff can leave an internal note.');
  }

  doc.messages.push({
    _id: newId(),
    authorId: author._id,
    authorName: author.name,
    fromStaff,
    body: input.body,
    internal,
    createdAt: new Date(),
  });

  if (!internal) {
    if (fromStaff && doc.status === 'open') doc.status = 'pending';
    // The reporter coming back reopens it, whatever it was closed as.
    if (!fromStaff && (doc.status === 'pending' || doc.status === 'resolved')) doc.status = 'open';
  }

  doc.updatedAt = new Date();
  await doc.save();

  await audit.record(
    author,
    {
      action: internal ? 'ticket.note_added' : 'ticket.replied',
      targetType: 'ticket',
      targetId: doc._id,
      summary: `${internal ? 'Note on' : 'Replied to'} ${doc.reference}`,
    },
    req,
  );
  return asContract<SupportTicket>(doc);
}

export interface SupportStats {
  open: number;
  pending: number;
  resolved30d: number;
  urgent: number;
  unassigned: number;
  /** Mean hours to resolution over the last 30 days, one decimal. */
  avgResolutionHours: number;
}

export async function supportStats(): Promise<SupportStats> {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [open, pending, urgent, unassigned, resolved] = await Promise.all([
    SupportTicketModel.countDocuments({ status: 'open' }),
    SupportTicketModel.countDocuments({ status: 'pending' }),
    SupportTicketModel.countDocuments({
      priority: 'urgent',
      status: { $in: ['open', 'pending'] },
    }),
    SupportTicketModel.countDocuments({
      assignedTo: { $exists: false },
      status: { $in: ['open', 'pending'] },
    }),
    SupportTicketModel.find({ resolvedAt: { $gte: from } }, { resolutionHours: 1 }),
  ]);

  const hours = resolved.map((t) => t.resolutionHours ?? 0).filter((h) => h > 0);
  return {
    open,
    pending,
    resolved30d: resolved.length,
    urgent,
    unassigned,
    avgResolutionHours: hours.length
      ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10
      : 0,
  };
}
