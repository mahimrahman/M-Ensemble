import { Router } from 'express';
import * as admin from '../controllers/admin.controller.js';
import * as billing from '../controllers/billing.controller.js';
import * as campaigns from '../controllers/campaign.controller.js';
import * as support from '../controllers/support.controller.js';
import {
  adminCreateEventSchema,
  advertiserListQuerySchema,
  auditListQuerySchema,
  campaignListQuerySchema,
  campaignStatusSchema,
  createAdvertiserSchema,
  createCampaignSchema,
  createDonationSchema,
  createInvoiceSchema,
  createMosqueSchema,
  createSubscriptionSchema,
  createTicketSchema,
  donationListQuerySchema,
  invoiceListQuerySchema,
  issueCredentialSchema,
  membershipRoleSchema,
  mosqueListQuerySchema,
  platformRoleSchema,
  recordPaymentSchema,
  ticketListQuerySchema,
  ticketMessageSchema,
  updateAdvertiserSchema,
  updateCampaignSchema,
  updateDonationSchema,
  updateSubscriptionSchema,
  updateTicketSchema,
  userListQuerySchema,
  userStatusSchema,
  voidInvoiceSchema,
} from '../schemas/admin.schema.js';
import { requirePlatform, requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * `/api/admin/*` — the super admin console's whole API surface.
 *
 * **Two tiers, and the split is visible in this file.** `requirePlatform` is
 * mounted once at the top, so nothing below is reachable without at least
 * `support`. Every route that *changes* something then adds `requireSuperAdmin`
 * on its own line. Reading that column tells you exactly what a support account
 * can and cannot do, which is a property a nested router would lose.
 *
 * Mounted under `requireAuth` by `routes/index.ts`, so a token is already
 * proven by the time anything here runs.
 */
export const adminRouter = Router();

// Floor for the whole console: `support` or above.
adminRouter.use(requirePlatform);

const write = requireSuperAdmin;

// ─── Session & overview ─────────────────────────────────────────────────────

adminRouter.get('/me', asyncHandler(admin.getSession));
adminRouter.get('/overview', asyncHandler(admin.getOverview));

// ─── Mosques ────────────────────────────────────────────────────────────────

adminRouter.get(
  '/mosques',
  validate(mosqueListQuerySchema, 'query'),
  asyncHandler(admin.listMosques),
);
adminRouter.get('/mosques/:id', asyncHandler(admin.getMosque));
adminRouter.post('/mosques', write, validate(createMosqueSchema), asyncHandler(admin.createMosque));

// Minting a coordinator account is the single most sensitive thing here — it
// hands somebody the keys to a mosque — so it is `superadmin` and nothing less.
adminRouter.post(
  '/mosques/:id/credentials',
  write,
  validate(issueCredentialSchema),
  asyncHandler(admin.issueCredential),
);
adminRouter.delete(
  '/mosques/:id/coordinators/:userId',
  write,
  asyncHandler(admin.revokeCoordinator),
);

// ─── Users ──────────────────────────────────────────────────────────────────

adminRouter.get('/users', validate(userListQuerySchema, 'query'), asyncHandler(admin.listUsers));
adminRouter.get('/users/:id', asyncHandler(admin.getUser));
adminRouter.put(
  '/users/:id/status',
  write,
  validate(userStatusSchema),
  asyncHandler(admin.setUserStatus),
);
adminRouter.put(
  '/users/:id/platform-role',
  write,
  validate(platformRoleSchema),
  asyncHandler(admin.setPlatformRole),
);
adminRouter.put(
  '/users/:id/membership',
  write,
  validate(membershipRoleSchema),
  asyncHandler(admin.setMembershipRole),
);
adminRouter.post('/users/:id/reset-password', write, asyncHandler(admin.resetPassword));

// ─── Events published on a mosque's behalf ──────────────────────────────────

adminRouter.post(
  '/events',
  write,
  validate(adminCreateEventSchema),
  asyncHandler(admin.createEvent),
);
adminRouter.post('/posts/:id/cancel', write, asyncHandler(admin.cancelPost));

// ─── Billing ────────────────────────────────────────────────────────────────

adminRouter.get('/billing/summary', asyncHandler(billing.getSummary));

adminRouter.get('/billing/subscriptions', asyncHandler(billing.listSubscriptions));
adminRouter.post(
  '/billing/subscriptions',
  write,
  validate(createSubscriptionSchema),
  asyncHandler(billing.upsertSubscription),
);
adminRouter.patch(
  '/billing/subscriptions/:id',
  write,
  validate(updateSubscriptionSchema),
  asyncHandler(billing.updateSubscription),
);

adminRouter.get(
  '/billing/invoices',
  validate(invoiceListQuerySchema, 'query'),
  asyncHandler(billing.listInvoices),
);
adminRouter.get('/billing/invoices/:id', asyncHandler(billing.getInvoice));
adminRouter.post(
  '/billing/invoices',
  write,
  validate(createInvoiceSchema),
  asyncHandler(billing.createInvoice),
);
adminRouter.post('/billing/invoices/:id/issue', write, asyncHandler(billing.issueInvoice));
adminRouter.post(
  '/billing/invoices/:id/void',
  write,
  validate(voidInvoiceSchema),
  asyncHandler(billing.voidInvoice),
);
adminRouter.post(
  '/billing/invoices/:id/payments',
  write,
  validate(recordPaymentSchema),
  asyncHandler(billing.recordPayment),
);

adminRouter.get(
  '/billing/donations',
  validate(donationListQuerySchema, 'query'),
  asyncHandler(billing.listDonations),
);
adminRouter.post(
  '/billing/donations',
  write,
  validate(createDonationSchema),
  asyncHandler(billing.createDonation),
);
adminRouter.patch(
  '/billing/donations/:id',
  write,
  validate(updateDonationSchema),
  asyncHandler(billing.updateDonation),
);

// ─── Partners & campaigns ───────────────────────────────────────────────────

adminRouter.get(
  '/advertisers',
  validate(advertiserListQuerySchema, 'query'),
  asyncHandler(campaigns.listAdvertisers),
);
adminRouter.post(
  '/advertisers',
  write,
  validate(createAdvertiserSchema),
  asyncHandler(campaigns.createAdvertiser),
);
adminRouter.patch(
  '/advertisers/:id',
  write,
  validate(updateAdvertiserSchema),
  asyncHandler(campaigns.updateAdvertiser),
);

adminRouter.get(
  '/campaigns',
  validate(campaignListQuerySchema, 'query'),
  asyncHandler(campaigns.listCampaigns),
);
adminRouter.get('/campaigns/:id', asyncHandler(campaigns.getCampaign));
adminRouter.post(
  '/campaigns',
  write,
  validate(createCampaignSchema),
  asyncHandler(campaigns.createCampaign),
);
adminRouter.patch(
  '/campaigns/:id',
  write,
  validate(updateCampaignSchema),
  asyncHandler(campaigns.updateCampaign),
);
adminRouter.put(
  '/campaigns/:id/status',
  write,
  validate(campaignStatusSchema),
  asyncHandler(campaigns.setCampaignStatus),
);

// ─── Support ────────────────────────────────────────────────────────────────
// Deliberately **not** `write`-gated: answering the inbox is the whole reason
// the `support` tier exists, and a role that can read a complaint but not reply
// to it would send every question back to a super admin.

adminRouter.get('/support/stats', asyncHandler(support.getStats));
adminRouter.get(
  '/support/tickets',
  validate(ticketListQuerySchema, 'query'),
  asyncHandler(support.listTickets),
);
adminRouter.get('/support/tickets/:id', asyncHandler(support.getTicket));
adminRouter.post(
  '/support/tickets',
  validate(createTicketSchema),
  asyncHandler(support.createTicket),
);
adminRouter.patch(
  '/support/tickets/:id',
  validate(updateTicketSchema),
  asyncHandler(support.updateTicket),
);
adminRouter.post(
  '/support/tickets/:id/messages',
  validate(ticketMessageSchema),
  asyncHandler(support.addMessage),
);

// ─── Audit ──────────────────────────────────────────────────────────────────
// Readable by `support` on purpose. A log only the people it records can read
// is not much of a check on them.

adminRouter.get('/audit', validate(auditListQuerySchema, 'query'), asyncHandler(admin.listAudit));
