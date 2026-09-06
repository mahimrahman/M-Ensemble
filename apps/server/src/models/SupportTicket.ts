import { Schema, model, type HydratedDocument } from 'mongoose';
import type { SupportTicket } from '@m-ensemble/shared';
import { SUBDOCUMENT, contractJson } from '../utils/serialize.js';

/**
 * One user problem, start to finish.
 *
 * The thread is **embedded**, not a second collection: a ticket is read whole
 * every time it is read at all, and the message count is bounded by the fact
 * that a human is typing them. The 16MB document ceiling is not a consideration
 * at that size.
 *
 * `userName` and `userEmail` are copied in at creation rather than joined on
 * read. That is on purpose — the inbox must still say who reported something
 * after the account is deleted, and a support record that loses its reporter is
 * useless for exactly the case it was kept for.
 */
export interface SupportTicketRecord extends Omit<
  SupportTicket,
  'messages' | 'createdAt' | 'updatedAt' | 'resolvedAt'
> {
  messages: TicketMessageRecord[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

interface TicketMessageRecord {
  _id: string;
  authorId: string;
  authorName: string;
  fromStaff: boolean;
  body: string;
  internal: boolean;
  createdAt: Date;
}

const messageSchema = new Schema<TicketMessageRecord>(
  {
    _id: { type: String, required: true },
    authorId: { type: String, required: true },
    authorName: { type: String, required: true },
    fromStaff: { type: Boolean, required: true, default: false },
    body: { type: String, required: true },
    internal: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true },
  },
  SUBDOCUMENT,
);

const ticketSchema = new Schema<SupportTicketRecord>(
  {
    _id: { type: String, required: true },
    reference: { type: String, required: true, unique: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      required: true,
      enum: ['account', 'billing', 'bug', 'mosque', 'content', 'feature', 'other'],
      default: 'other',
    },
    status: {
      type: String,
      required: true,
      enum: ['open', 'pending', 'resolved', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    userId: { type: String },
    userName: { type: String },
    userEmail: { type: String },
    mosqueId: { type: String },
    assignedTo: { type: String },
    assignedToName: { type: String },
    messages: { type: [messageSchema], default: [] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    resolvedAt: { type: Date },
    resolutionHours: { type: Number },
  },
  contractJson(),
);

// The inbox is "open tickets, worst first", then "everything, newest first".
ticketSchema.index({ status: 1, priority: 1, updatedAt: -1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ mosqueId: 1 });

export type SupportTicketDocument = HydratedDocument<SupportTicketRecord>;
export const SupportTicketModel = model<SupportTicketRecord>('SupportTicket', ticketSchema);
