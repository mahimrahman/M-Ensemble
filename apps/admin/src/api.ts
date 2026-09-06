import type {
  Advertiser,
  AdvertiserStatus,
  AuditEntry,
  AuthResult,
  BillingSummary,
  CampaignStatus,
  CampaignWithAdvertiser,
  CreateAdvertiserInput,
  CreateCampaignInput,
  CreateDonationInput,
  CreateInvoiceInput,
  CreateMosqueInput,
  CreateSubscriptionInput,
  CreateTicketInput,
  Donation,
  DonationStatus,
  ID,
  Invoice,
  InvoiceKind,
  InvoiceStatus,
  IssuedCredential,
  MemberRole,
  Mosque,
  MosqueDetail,
  MosqueSummary,
  PageResult,
  Payment,
  PlatformOverview,
  PlatformRole,
  PlatformUser,
  Post,
  RecordPaymentInput,
  Subscription,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UpdateAdvertiserInput,
  UpdateCampaignInput,
  UpdateSubscriptionInput,
  UpdateTicketInput,
  UserStatus,
} from '@m-ensemble/shared';

/**
 * The console's transport.
 *
 * **Types only from `@m-ensemble/shared`.** That package is CommonJS TypeScript
 * source consumed straight from the workspace, and a type import is erased at
 * compile time — so nothing of it reaches this bundle. Anything the console
 * needs at *runtime* (plan prices, money formatting) it defines in `lib/format`
 * rather than importing, which keeps the browser build free of that package's
 * module-format problem entirely.
 *
 * The base is relative. In development Vite proxies `/api` to :4000, and in
 * production the console is served from the same origin as the API — so there is
 * no build-time API URL to get wrong and no CORS entry to maintain.
 */

const TOKEN_KEY = 'mensemble.admin.token';

export function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private mode, or storage blocked. The session still works for this tab;
    // it just will not survive a reload.
    return null;
  }
}

export function storeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* see above */
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Fired when the server rejects the token, so the shell can sign out once. */
export const UNAUTHORIZED_EVENT = 'mensemble:unauthorized';

type Query = Record<string, string | number | boolean | undefined | null>;

function queryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    // Empty string means "no filter" everywhere in this app — a `?status=` that
    // reached the server would be a validation error rather than a cleared box.
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; query?: Query } = {},
): Promise<T> {
  const token = storedToken();

  let response: Response;
  try {
    response = await fetch(`/api${path}${queryString(options.query)}`, {
      method,
      headers: {
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    // `fetch` rejects outright when there is nothing listening — the API not
    // running is by far the most common reason, and it happens before any
    // status code exists to branch on. Without this the failure escapes as a
    // bare TypeError and every screen says "Something went wrong", which sends
    // people looking for a bug in the console rather than starting the server.
    throw new ApiError(
      0,
      'NETWORK',
      'Cannot reach the API. Check that it is running on http://localhost:4000.',
    );
  }

  // The API always sends a body, including on errors — `okNull` exists so that
  // even a void endpoint replies `{ ok: true, data: null }` rather than 204.
  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; details?: unknown } }
    | null;

  if (!payload) {
    throw new ApiError(response.status, 'NETWORK', 'The server sent an unreadable response.');
  }

  if (!payload.ok) {
    if (response.status === 401) {
      // One place decides what a dead token means. The shell listens and signs
      // out; every caller just sees the error.
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }

  return payload.data;
}

/**
 * Upload one image and get back the path the server stored it at.
 *
 * **Not through `request`**, which sets `Content-Type: application/json`. A
 * multipart body needs the browser to write that header itself, including the
 * boundary token it generates — setting it by hand produces a body the server
 * cannot parse, and the failure looks like a corrupt file rather than a wrong
 * header.
 *
 * Two endpoints behind one function. With a `mosqueId` this is a poster and
 * goes through the mosque-scoped route; without one it is a partner logo or a
 * campaign creative, which belong to no mosque and go through the platform
 * route. The caller says which by passing the id or not.
 */
export async function uploadImage(
  file: File,
  mosqueId?: string,
): Promise<{ url: string; width: number; height: number; bytes: number }> {
  const form = new FormData();
  form.append('image', file);
  if (mosqueId) form.append('mosqueId', mosqueId);

  const token = storedToken();
  const response = await fetch(`/api/uploads/${mosqueId ? 'poster' : 'image'}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: { url: string; width: number; height: number; bytes: number } }
    | { ok: false; error: { code: string; message: string } }
    | null;

  if (!payload) throw new ApiError(response.status, 'NETWORK', 'The upload got no usable reply.');
  if (!payload.ok) {
    if (response.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new ApiError(response.status, payload.error.code, payload.error.message);
  }
  return payload.data;
}

const get = <T>(path: string, query?: Query) => request<T>('GET', path, { query });
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body });
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body });
const put = <T>(path: string, body?: unknown) => request<T>('PUT', path, { body });
const del = <T>(path: string) => request<T>('DELETE', path);

// ─── Session ────────────────────────────────────────────────────────────────

export interface AdminSession {
  userId: ID;
  name: string;
  email: string;
  platformRole: PlatformRole;
}

export const api = {
  /** The same endpoint the app signs in with. The role check happens next. */
  login: (email: string, password: string) => post<AuthResult>('/auth/login', { email, password }),
  session: () => get<AdminSession>('/admin/me'),

  overview: () => get<PlatformOverview>('/admin/overview'),

  // ── Mosques ──
  mosques: (query?: Query) => get<PageResult<MosqueSummary>>('/admin/mosques', query),
  mosque: (id: ID) => get<MosqueDetail>(`/admin/mosques/${id}`),
  createMosque: (input: CreateMosqueInput) =>
    post<{ mosque: Mosque; credential?: IssuedCredential }>('/admin/mosques', input),
  issueCredential: (mosqueId: ID, input: { name: string; email: string; password?: string }) =>
    post<IssuedCredential>(`/admin/mosques/${mosqueId}/credentials`, input),
  revokeCoordinator: (mosqueId: ID, userId: ID) =>
    del<null>(`/admin/mosques/${mosqueId}/coordinators/${userId}`),

  // ── Users ──
  users: (query?: Query) => get<PageResult<PlatformUser>>('/admin/users', query),
  user: (id: ID) => get<PlatformUser>(`/admin/users/${id}`),
  setUserStatus: (id: ID, status: UserStatus) =>
    put<PlatformUser>(`/admin/users/${id}/status`, { status }),
  setPlatformRole: (id: ID, platformRole: PlatformRole) =>
    put<PlatformUser>(`/admin/users/${id}/platform-role`, { platformRole }),
  setMembership: (id: ID, mosqueId: ID, role: MemberRole) =>
    put<PlatformUser>(`/admin/users/${id}/membership`, { mosqueId, role }),
  resetPassword: (id: ID) =>
    post<{ userId: ID; email: string; password: string }>(`/admin/users/${id}/reset-password`),

  // ── Events published for a mosque ──
  createEvent: (input: Record<string, unknown>) => post<Post>('/admin/events', input),
  cancelPost: (id: ID) => post<Post>(`/admin/posts/${id}/cancel`),

  // ── Billing ──
  billingSummary: () => get<BillingSummary>('/admin/billing/summary'),
  subscriptions: () => get<Subscription[]>('/admin/billing/subscriptions'),
  upsertSubscription: (input: CreateSubscriptionInput) =>
    post<Subscription>('/admin/billing/subscriptions', input),
  updateSubscription: (id: ID, input: UpdateSubscriptionInput) =>
    patch<Subscription>(`/admin/billing/subscriptions/${id}`, input),

  invoices: (query?: Query) => get<PageResult<Invoice>>('/admin/billing/invoices', query),
  invoice: (id: ID) =>
    get<{ invoice: Invoice; payments: Payment[] }>(`/admin/billing/invoices/${id}`),
  createInvoice: (input: CreateInvoiceInput) => post<Invoice>('/admin/billing/invoices', input),
  issueInvoice: (id: ID) => post<Invoice>(`/admin/billing/invoices/${id}/issue`),
  voidInvoice: (id: ID, reason?: string) =>
    post<Invoice>(`/admin/billing/invoices/${id}/void`, { reason }),
  recordPayment: (id: ID, input: RecordPaymentInput) =>
    post<{ invoice: Invoice; payments: Payment[] }>(
      `/admin/billing/invoices/${id}/payments`,
      input,
    ),

  donations: (query?: Query) => get<PageResult<Donation>>('/admin/billing/donations', query),
  createDonation: (input: CreateDonationInput) => post<Donation>('/admin/billing/donations', input),
  updateDonation: (id: ID, input: { status?: DonationStatus; markPaidOut?: boolean }) =>
    patch<Donation>(`/admin/billing/donations/${id}`, input),

  // ── Partners & campaigns ──
  advertisers: (query?: Query) => get<PageResult<Advertiser>>('/admin/advertisers', query),
  createAdvertiser: (input: CreateAdvertiserInput) => post<Advertiser>('/admin/advertisers', input),
  updateAdvertiser: (id: ID, input: UpdateAdvertiserInput) =>
    patch<Advertiser>(`/admin/advertisers/${id}`, input),

  campaigns: (query?: Query) => get<PageResult<CampaignWithAdvertiser>>('/admin/campaigns', query),
  campaign: (id: ID) => get<CampaignWithAdvertiser>(`/admin/campaigns/${id}`),
  createCampaign: (input: CreateCampaignInput) =>
    post<CampaignWithAdvertiser>('/admin/campaigns', input),
  updateCampaign: (id: ID, input: UpdateCampaignInput) =>
    patch<CampaignWithAdvertiser>(`/admin/campaigns/${id}`, input),
  setCampaignStatus: (id: ID, status: CampaignStatus, reason?: string) =>
    put<CampaignWithAdvertiser>(`/admin/campaigns/${id}/status`, { status, reason }),

  // ── Support ──
  supportStats: () =>
    get<{
      open: number;
      pending: number;
      resolved30d: number;
      urgent: number;
      unassigned: number;
      avgResolutionHours: number;
    }>('/admin/support/stats'),
  tickets: (query?: Query) => get<PageResult<SupportTicket>>('/admin/support/tickets', query),
  ticket: (id: ID) => get<SupportTicket>(`/admin/support/tickets/${id}`),
  createTicket: (input: CreateTicketInput) => post<SupportTicket>('/admin/support/tickets', input),
  updateTicket: (id: ID, input: UpdateTicketInput) =>
    patch<SupportTicket>(`/admin/support/tickets/${id}`, input),
  replyToTicket: (id: ID, body: string, internal = false) =>
    post<SupportTicket>(`/admin/support/tickets/${id}/messages`, { body, internal }),

  // ── Audit ──
  audit: (query?: Query) => get<PageResult<AuditEntry>>('/admin/audit', query),
};

/** Re-exported so pages can name a filter's type without importing shared twice. */
export type {
  AdvertiserStatus,
  CampaignStatus,
  DonationStatus,
  InvoiceKind,
  InvoiceStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
};
