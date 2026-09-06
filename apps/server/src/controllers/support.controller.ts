import type { Request, Response } from 'express';
import type {
  AddTicketMessageInput,
  CreateTicketInput,
  UpdateTicketInput,
} from '@m-ensemble/shared';
import { currentUser } from '../middleware/requireAuth.js';
import * as support from '../services/support.service.js';
import { ok } from '../utils/respond.js';

/**
 * The support inbox.
 *
 * Reads and replies are open to `support` as well as `superadmin` — answering
 * the inbox is the entire reason that tier exists. See `admin.routes.ts`.
 */

export async function getStats(_req: Request, res: Response): Promise<void> {
  ok(res, await support.supportStats());
}

export async function listTickets(req: Request, res: Response): Promise<void> {
  ok(res, await support.listTickets(req.query as never));
}

export async function getTicket(req: Request, res: Response): Promise<void> {
  ok(res, await support.getTicket(String(req.params.id)));
}

export async function createTicket(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateTicketInput;
  ok(res, await support.createTicket(input, currentUser(req), req), 201);
}

export async function updateTicket(req: Request, res: Response): Promise<void> {
  const patch = req.body as UpdateTicketInput;
  ok(res, await support.updateTicket(String(req.params.id), patch, currentUser(req), req));
}

export async function addMessage(req: Request, res: Response): Promise<void> {
  const input = req.body as AddTicketMessageInput;
  ok(res, await support.addMessage(String(req.params.id), input, currentUser(req), req), 201);
}
