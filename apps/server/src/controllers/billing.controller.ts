import type { Request, Response } from 'express';
import type {
  CreateDonationInput,
  CreateInvoiceInput,
  CreateSubscriptionInput,
  DonationStatus,
  RecordPaymentInput,
  UpdateSubscriptionInput,
} from '@m-ensemble/shared';
import { currentUser } from '../middleware/requireAuth.js';
import * as billing from '../services/billing.service.js';
import { ok } from '../utils/respond.js';

/**
 * The money endpoints.
 *
 * Reads are open to `support` — somebody answering "why does my mosque have an
 * invoice" needs to see it. Every write here is `superadmin`, which the routes
 * enforce; see `admin.routes.ts`.
 */

// ─── Summary ────────────────────────────────────────────────────────────────

export async function getSummary(_req: Request, res: Response): Promise<void> {
  ok(res, await billing.billingSummary());
}

// ─── Subscriptions ──────────────────────────────────────────────────────────

export async function listSubscriptions(_req: Request, res: Response): Promise<void> {
  ok(res, await billing.listSubscriptions());
}

export async function upsertSubscription(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateSubscriptionInput;
  ok(res, await billing.upsertSubscription(input, currentUser(req), req), 201);
}

export async function updateSubscription(req: Request, res: Response): Promise<void> {
  const patch = req.body as UpdateSubscriptionInput;
  ok(res, await billing.updateSubscription(String(req.params.id), patch, currentUser(req), req));
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response): Promise<void> {
  ok(res, await billing.listInvoices(req.query as never));
}

export async function getInvoice(req: Request, res: Response): Promise<void> {
  ok(res, await billing.getInvoice(String(req.params.id)));
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateInvoiceInput;
  ok(res, await billing.createInvoice(input, currentUser(req), req), 201);
}

export async function issueInvoice(req: Request, res: Response): Promise<void> {
  ok(res, await billing.issueInvoice(String(req.params.id), currentUser(req), req));
}

export async function voidInvoice(req: Request, res: Response): Promise<void> {
  const { reason } = req.body as { reason?: string };
  ok(res, await billing.voidInvoice(String(req.params.id), reason, currentUser(req), req));
}

export async function recordPayment(req: Request, res: Response): Promise<void> {
  const input = req.body as RecordPaymentInput;
  ok(res, await billing.recordPayment(String(req.params.id), input, currentUser(req), req), 201);
}

// ─── Donations ──────────────────────────────────────────────────────────────

export async function listDonations(req: Request, res: Response): Promise<void> {
  ok(res, await billing.listDonations(req.query as never));
}

export async function createDonation(req: Request, res: Response): Promise<void> {
  const input = req.body as CreateDonationInput;
  ok(res, await billing.createDonation(input, currentUser(req), req), 201);
}

export async function updateDonation(req: Request, res: Response): Promise<void> {
  const patch = req.body as { status?: DonationStatus; markPaidOut?: boolean; note?: string };
  ok(res, await billing.updateDonation(String(req.params.id), patch, currentUser(req), req));
}
