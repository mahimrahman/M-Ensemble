import { z } from 'zod';

/**
 * Request shapes for the platform tier.
 *
 * Everything here is behind `requireSuperAdmin`, and it is still validated as
 * strictly as the public routes. "The caller is trusted" is a statement about
 * intent, not about the JSON a half-finished form posts — and these endpoints
 * write money and credentials, which is exactly where a silently-coerced field
 * costs the most to find later.
 */

const ISO = z.string().datetime({ offset: true }).or(z.string().datetime());
const CENTS = z.number().int();
const POSITIVE_CENTS = CENTS.min(0);

/** Shared by every table: `?page=2&pageSize=50&q=khadija&sort=name&dir=asc`. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
  q: z.string().max(200).optional(),
  sort: z.string().max(60).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

/**
 * A path this API minted, and nothing else.
 *
 * Every one of these is rendered by a client we do not control — a partner
 * logo in the console, a campaign creative in twenty thousand feeds — so a
 * free-form URL here would let one operator point every reader's app at a host
 * they own. Same rule and same regex as `imageUrl` in `post.schema.ts`.
 */
const storedImage = z
  .string()
  .regex(/^\/uploads\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/, 'Unrecognised image path.');

/** `?flag=true` off a query string, where everything arrives as a string. */
const boolish = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));

// ─── Mosques ────────────────────────────────────────────────────────────────

const coordinatorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  /**
   * Optional, and when absent the server generates one. The floor matches the
   * app's own sign-up rule so a provisioned account can sign in on the screen
   * every other account uses.
   */
  password: z.string().min(6).max(200).optional(),
});

export const createMosqueSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    address: z.string().trim().min(4).max(300),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    city: z.string().max(80).optional(),
    timezone: z.string().max(80).optional(),
    bio: z.string().max(2000).optional(),
    website: z.string().max(200).optional(),
    phone: z.string().max(60).optional(),
    // Uppercased here rather than in the service, so the uniqueness check and
    // the stored value can never be in different cases.
    joinCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{4,12}$/, 'Letters and digits, 4–12 characters.')
      .transform((v) => v.toUpperCase())
      .optional(),
    prayerConfig: z
      .object({
        calculationMethod: z.string().min(1),
        madhab: z.enum(['shafi', 'hanafi']),
        highLatitudeRule: z.string().min(1),
      })
      .optional(),
    coordinator: coordinatorSchema.optional(),
    plan: z.enum(['free', 'standard', 'pro']).optional(),
  })
  .strict();

export const issueCredentialSchema = coordinatorSchema.strict();

export const mosqueListQuerySchema = pageQuerySchema.extend({
  operated: boolish,
  plan: z.enum(['free', 'standard', 'pro']).optional(),
  city: z.string().max(80).optional(),
});

// ─── Users ──────────────────────────────────────────────────────────────────

export const userListQuerySchema = pageQuerySchema.extend({
  platformRole: z.enum(['none', 'support', 'superadmin']).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  mosqueId: z.string().max(200).optional(),
});

export const userStatusSchema = z.object({ status: z.enum(['active', 'suspended']) }).strict();

export const platformRoleSchema = z
  .object({ platformRole: z.enum(['none', 'support', 'superadmin']) })
  .strict();

export const membershipRoleSchema = z
  .object({ mosqueId: z.string().min(1), role: z.enum(['member', 'admin']) })
  .strict();

// ─── Subscriptions ──────────────────────────────────────────────────────────

export const createSubscriptionSchema = z
  .object({
    mosqueId: z.string().min(1),
    plan: z.enum(['free', 'standard', 'pro']),
    interval: z.enum(['monthly', 'yearly']).optional(),
    priceCents: POSITIVE_CENTS.optional(),
    status: z.enum(['active', 'trialing', 'past_due', 'cancelled']).optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const updateSubscriptionSchema = z
  .object({
    plan: z.enum(['free', 'standard', 'pro']).optional(),
    status: z.enum(['active', 'trialing', 'past_due', 'cancelled']).optional(),
    interval: z.enum(['monthly', 'yearly']).optional(),
    priceCents: POSITIVE_CENTS.optional(),
    note: z.string().max(500).optional(),
    currentPeriodEnd: ISO.optional(),
  })
  .strict();

// ─── Invoices ───────────────────────────────────────────────────────────────

export const createInvoiceSchema = z
  .object({
    kind: z.enum(['subscription', 'campaign', 'donation_fee', 'other']),
    mosqueId: z.string().min(1).optional(),
    advertiserId: z.string().min(1).optional(),
    sourceId: z.string().min(1).optional(),
    lines: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(300),
          quantity: z.number().min(0).max(100_000),
          // Signed: a credit line is a negative unit price on the same invoice,
          // which is how a discount is expressed without a second document.
          unitCents: CENTS,
        }),
      )
      .min(1)
      .max(50),
    taxCents: CENTS.optional(),
    currency: z.enum(['CAD', 'USD']).optional(),
    dueInDays: z.number().int().min(0).max(365).optional(),
    note: z.string().max(1000).optional(),
    issue: z.boolean().optional(),
  })
  .strict();

export const invoiceListQuerySchema = pageQuerySchema.extend({
  status: z.enum(['draft', 'open', 'paid', 'void', 'uncollectible']).optional(),
  kind: z.enum(['subscription', 'campaign', 'donation_fee', 'other']).optional(),
  mosqueId: z.string().max(200).optional(),
  advertiserId: z.string().max(200).optional(),
  overdue: boolish,
});

export const recordPaymentSchema = z
  .object({
    // Signed on purpose: a payment recorded in error is corrected with a
    // negative row, never edited away. See `Payment` in the contract.
    amountCents: CENTS.refine((v) => v !== 0, 'A payment of zero records nothing.'),
    method: z.enum(['manual', 'etransfer', 'cheque', 'cash', 'card', 'other']),
    reference: z.string().max(200).optional(),
    receivedAt: ISO.optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const voidInvoiceSchema = z.object({ reason: z.string().max(500).optional() }).strict();

// ─── Donations ──────────────────────────────────────────────────────────────

export const createDonationSchema = z
  .object({
    mosqueId: z.string().min(1),
    userId: z.string().min(1).optional(),
    postId: z.string().min(1).optional(),
    donorName: z.string().max(200).optional(),
    donorEmail: z.string().email().max(200).optional(),
    amountCents: POSITIVE_CENTS.min(1),
    feeCents: POSITIVE_CENTS.optional(),
    status: z.enum(['pending', 'settled', 'refunded', 'failed']).optional(),
    method: z.enum(['manual', 'etransfer', 'cheque', 'cash', 'card', 'other']).optional(),
    reference: z.string().max(200).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const updateDonationSchema = z
  .object({
    status: z.enum(['pending', 'settled', 'refunded', 'failed']).optional(),
    markPaidOut: z.boolean().optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

export const donationListQuerySchema = pageQuerySchema.extend({
  mosqueId: z.string().max(200).optional(),
  status: z.enum(['pending', 'settled', 'refunded', 'failed']).optional(),
  unpaidOut: boolish,
});

// ─── Advertisers & campaigns ────────────────────────────────────────────────

export const createAdvertiserSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    category: z.string().trim().min(1).max(80),
    contactName: z.string().max(200).optional(),
    contactEmail: z.string().email().max(200).optional(),
    contactPhone: z.string().max(60).optional(),
    website: z.string().max(300).optional(),
    logoUrl: storedImage.optional(),
    status: z.enum(['active', 'paused', 'archived']).optional(),
    note: z.string().max(1000).optional(),
  })
  .strict();

export const updateAdvertiserSchema = createAdvertiserSchema.partial().strict();

/**
 * `ctaUrl` must be `http(s)` and absolute.
 *
 * It is rendered as a tappable link in tens of thousands of feeds, so the
 * scheme is the thing to pin down: a `javascript:` or `data:` URL here is a
 * script the app runs, and a relative one would resolve against our own host
 * and make a partner's advert look like a page we published.
 */
const ctaUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v), 'The link must start with http:// or https://');

const creativeSchema = z.object({
  headline: z.string().trim().min(2).max(80),
  body: z.string().trim().min(2).max(200),
  imageUrl: storedImage.optional(),
  ctaLabel: z.string().trim().min(1).max(30),
  ctaUrl,
  disclosure: z.string().max(120).optional(),
});

const targetingSchema = z.object({
  cities: z.array(z.string().max(80)).max(20).optional(),
  mosqueIds: z.array(z.string().max(200)).max(200).optional(),
  interests: z.array(z.string().max(80)).max(30).optional(),
  placements: z
    .array(z.enum(['feed', 'mosque-profile', 'post-detail']))
    .max(3)
    .optional(),
});

export const createCampaignSchema = z
  .object({
    advertiserId: z.string().min(1),
    name: z.string().trim().min(2).max(200),
    creative: creativeSchema,
    targeting: targetingSchema.optional(),
    startAt: ISO,
    endAt: ISO,
    budgetCents: POSITIVE_CENTS,
    pricing: z.enum(['flat', 'cpm', 'cpc']).optional(),
    rateCents: POSITIVE_CENTS.optional(),
  })
  .strict();

export const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    creative: creativeSchema.partial().optional(),
    targeting: targetingSchema.optional(),
    startAt: ISO.optional(),
    endAt: ISO.optional(),
    budgetCents: POSITIVE_CENTS.optional(),
    pricing: z.enum(['flat', 'cpm', 'cpc']).optional(),
    rateCents: POSITIVE_CENTS.optional(),
  })
  .strict();

export const campaignStatusSchema = z
  .object({
    status: z.enum(['draft', 'pending', 'active', 'paused', 'completed', 'rejected']),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const campaignListQuerySchema = pageQuerySchema.extend({
  status: z.enum(['draft', 'pending', 'active', 'paused', 'completed', 'rejected']).optional(),
  advertiserId: z.string().max(200).optional(),
});

export const advertiserListQuerySchema = pageQuerySchema.extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
});

// ─── Ad delivery (the mobile app's side) ────────────────────────────────────

export const adSlotQuerySchema = z.object({
  placement: z.enum(['feed', 'mosque-profile', 'post-detail']).default('feed'),
  city: z.string().max(80).optional(),
  mosqueId: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(5).optional(),
});

export const adEventSchema = z.object({ kind: z.enum(['impression', 'click']) }).strict();

// ─── Support ────────────────────────────────────────────────────────────────

const TICKET_CATEGORIES = [
  'account',
  'billing',
  'bug',
  'mosque',
  'content',
  'feature',
  'other',
] as const;

export const createTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200),
    body: z.string().trim().min(1).max(5000),
    category: z.enum(TICKET_CATEGORIES).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    userId: z.string().min(1).optional(),
    mosqueId: z.string().min(1).optional(),
  })
  .strict();

export const updateTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(200).optional(),
    status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    category: z.enum(TICKET_CATEGORIES).optional(),
    // Empty string clears the assignment, which a `.min(1)` could not express.
    assignedTo: z.string().max(200).optional(),
  })
  .strict();

export const ticketMessageSchema = z
  .object({ body: z.string().trim().min(1).max(5000), internal: z.boolean().optional() })
  .strict();

export const ticketListQuerySchema = pageQuerySchema.extend({
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  assignedTo: z.string().max(200).optional(),
  mosqueId: z.string().max(200).optional(),
  openOnly: boolish,
});

// ─── Events published on a mosque's behalf ──────────────────────────────────

export const adminCreateEventSchema = z
  .object({
    mosqueId: z.string().min(1),
    type: z.enum(['event', 'class', 'volunteer', 'announcement']),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(4000),
    category: z.string().trim().min(1).max(80),
    startAt: ISO,
    endAt: ISO,
    location: z.string().trim().min(1).max(300),
    slotsNeeded: z.number().int().min(1).max(1000).optional(),
    capacity: z.number().int().min(1).max(100_000).optional(),
    imageUrl: storedImage.optional(),
    notify: z.boolean().optional(),
  })
  .strict()
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  });

// ─── Audit ──────────────────────────────────────────────────────────────────

export const auditListQuerySchema = pageQuerySchema.extend({
  actorId: z.string().max(200).optional(),
  targetType: z
    .enum([
      'mosque',
      'user',
      'invoice',
      'subscription',
      'campaign',
      'advertiser',
      'ticket',
      'donation',
      'post',
    ])
    .optional(),
  targetId: z.string().max(200).optional(),
  action: z.string().max(80).optional(),
});
