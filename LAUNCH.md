# Launch checklist

Everything that has to be done before M'Ensemble is a registered company taking
money from real mosques, with the app live on the App Store and Google Play.

Nothing ships until every box in sections 0–5 is ticked. Section 6 is the
go-to-market work that runs alongside.

Assumptions: Quebec-based, federal incorporation, CAD pricing, subscriptions
first, donations in month 2, ads later. Legal and tax items need a professional's
sign-off before anything is signed.

---

## 0. Ownership and repo

- [ ] Written IP assignment or vesting agreement (4 years, 1-year cliff) from each hackathon teammate
- [ ] Decide cofounders vs. contributors; shareholders' agreement if more than one owner
- [ ] Make the repo private; replace the MIT `LICENSE` with a proprietary notice for new work
- [ ] Remove `Setup and credentials.md`, `database.json`, `plan.md` from the repo
- [ ] Rotate every seeded password (`mensemble`, `123456`, `mensemble-admin`) and the super-admin email
- [ ] Name search: Quebec REQ, Nuans, CIPO trademarks, App Store, Google Play
- [ ] Buy the domain (`.ca` plus `.com` or `.app`)

## 1. Company registration

- [ ] Incorporate federally (Corporations Canada)
- [ ] Register with the Registraire des entreprises du Québec
- [ ] CRA Business Number
- [ ] GST/HST and QST accounts
- [ ] Business bank account
- [ ] Stripe account in the company's name (needs incorporation documents and bank account)
- [ ] Request a D-U-N-S number (takes 1–2 weeks; needed for the Apple organisation account)
- [ ] Apple Developer Program, organisation account
- [ ] Google Play developer account
- [ ] Accountant: fiscal year end, SR&ED eligibility, payroll setup
- [ ] Bookkeeping tool connected to the bank and Stripe

## 2. Legal documents

- [ ] Mosque service agreement (scope, price, billing cycle, uptime, data ownership, termination, liability cap), FR and EN
- [ ] Terms of service for members, FR and EN
- [ ] Privacy policy, FR and EN, covering location, camera, photos, push tokens, ads
- [ ] Law 25: named privacy officer, consent flows for location and notifications, incident register, privacy impact assessment if data leaves Quebec
- [ ] Bill 96: French versions of every contract and every app string reviewed
- [ ] Advertiser agreement and "Sponsored" disclosure rules
- [ ] Donation terms and receipt wording (mosques issue tax receipts, not us)
- [ ] E-signature tool for agreements

## 3. Server: security and production readiness

### Fix what's broken today

- [x] `npm install` so workspace symlinks point at `E:\Projects\M-Ensemble`, not `E:\M-Ensemble`
- [x] Fix the three typecheck errors in `tests/notifications.test.ts`, `tests/seed-preserves-accounts.test.ts`, `tests/signup-race.test.ts`
- [x] Full test suite green locally and in CI

### Hardening

- [x] Rate limiting on `/api/auth/login` and `/api/auth/signup` (per IP and per email)
- [x] Production refuses to start if `JWT_SECRET` is `change-me` or shorter than 32 chars
- [x] Production refuses to start if `CORS_ORIGIN` is `*`
- [x] Production refuses to start with the default `SUPERADMIN_PASSWORD`
- [x] Password minimum raised to 8 characters, common-password check
- [x] Password reset by email (token, expiry, one-time use)
- [x] Email verification on signup
- [x] Token revocation on logout and password change (deny list or token version on the user)
- [x] Shorter token TTL (7 days) with refresh, or keep 30 days but revocable
- [x] `DELETE /api/me` account deletion: removes user, memberships, signups, push tokens, likes; anonymises audit rows
- [x] Data export endpoint for Law 25 access requests
- [x] Request body size, upload count and per-user upload quota limits
- [x] Audit log covers every super-admin money and access action
- [ ] Dependency audit clean (`npm audit`), Dependabot or Renovate enabled
- [x] Remove `console.log` in favour of a structured logger with levels

### Payments

- [x] Stripe Billing: one Stripe customer per mosque, stored in `Subscription.externalRef`
- [x] Checkout session or payment link generated from the admin console
- [x] Webhook handler: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated/deleted` flip `Subscription.status` and create `Invoice`/`Payment` rows
- [x] Webhook signature verification and idempotency on event ID
- [x] Manual bank-transfer invoicing path kept for mosques that refuse cards
- [x] Tax: GST/HST and QST applied on invoices (Stripe Tax or manual rates)
- [x] Stripe Connect Express accounts for mosques receiving donations
- [x] Donation checkout with `application_fee_amount` from `platformFeeCents`
- [x] Donation receipts emailed to the donor
- [ ] Refund and dispute handling procedure written down
- [ ] Stripe test mode end-to-end run, then live keys in production env only

### Infrastructure

- [ ] MongoDB Atlas, Canadian region, daily backups, point-in-time recovery, restore tested once
- [x] API deployed to a Canadian region host, compiled build (not `tsx` in production) or a documented decision to keep `tsx`
- [x] `Dockerfile` and deployment config committed
- [ ] HTTPS with a real certificate on `api.<domain>`
- [x] Uploads moved to object storage (S3 or R2) behind a CDN; `UPLOAD_DIR` local disk retired
- [x] Transactional email provider (receipts, password reset, verification), SPF/DKIM/DMARC set
- [x] Error tracking (Sentry) on server, admin and mobile
- [ ] Uptime monitoring with alerting to your phone
- [x] Health endpoint checks Mongo connectivity, not just process liveness
- [x] Staging environment separate from production, with its own database and Stripe test keys
- [x] Secrets in the host's secret manager, never in the repo
- [x] Seed script blocked from running against production
- [ ] Admin console deployed on `admin.<domain>` behind HTTPS, super-admin only
- [x] Incident runbook: who gets paged, how to roll back, how to restore the database

## 4. Mobile app: store readiness

- [x] Remove the one-tap demo accounts from `app/(auth)/login.tsx`
- [x] Fixed `EXPO_PUBLIC_API_URL=https://api.<domain>/api` for release builds; dev-host fallback only in development
- [x] `eas.json` with `development`, `preview`, `production` profiles
- [ ] EAS project ID in `app.json` `extra.eas.projectId`
- [x] Version `1.0.0`, build numbers auto-incremented
- [ ] APNs key uploaded to EAS; Firebase project and `google-services.json` for Android push
- [ ] Push notifications tested on a physical iPhone and a physical Android from a release build
- [x] Account deletion screen (Profile → Delete account) calling `DELETE /api/me`
- [x] Privacy policy and terms linked from signup and from Profile
- [x] Consent prompts for location and notifications explain why, FR and EN
- [x] Password reset screen
- [x] Donations open Stripe Checkout in the browser, not an in-app payment
- [x] "Sponsored" label on every ad creative
- [x] Offline and slow-network states: no infinite spinners, clear error messages
- [x] Accessibility pass: font scaling, contrast, screen reader labels on icon buttons
- [ ] App icon, splash, and store screenshots for 6.7", 6.1", 5.5" iPhone, 12.9" iPad, Android phone and tablet
- [x] Store listing text FR and EN
- [ ] App Store privacy labels and Google Play Data Safety form filled (location, camera, photos, identifiers, ads)
- [ ] Apple: demo account for reviewers in App Review notes (a dedicated reviewer account, not a seeded one)
- [ ] Apple: justify location, camera and photo usage in review notes
- [ ] Google: target API level current, 64-bit, app signing by Google Play enrolled
- [ ] TestFlight build to pilot mosques, two weeks minimum
- [ ] Play internal testing track, same duration
- [ ] Crash-free rate above 99% across the test period before submission
- [ ] Submit to both stores; budget one rejection round

## 5. Admin console

- [ ] Deployed behind HTTPS, login rate-limited, super-admin only
- [x] Billing screen creates Stripe customers and sends payment links
- [x] Shows Stripe subscription status and last invoice state per mosque
- [x] Mosque onboarding flow produces coordinator credentials and sends them by email, not shown on screen
- [x] Credential slip page (`CredentialSlip.tsx`) removed or replaced with the email flow
- [x] Support tickets have an assignee and a response-time view

## 6. Go-to-market (runs alongside 3–5)

- [ ] One price per mosque per month in CAD; yearly at ~10 months; founding-mosque rate locked two years for the first ten
- [ ] Pricing validated in conversations with five mosques before publishing
- [ ] Pilot: 3–5 mosques, 90 days free, signed letter of intent, weekly 20-minute call, permission to use their name
- [ ] Onboarding runbook: 30-minute setup call, prayer times imported, first three posts published for them
- [ ] One-page coordinator guide in French
- [ ] Support email and WhatsApp number, one-business-day response promise
- [ ] Day-60: agreement and payment link sent; day-90: trial ends, unpaid goes `past_due`
- [ ] Landing page on the domain with pricing, FR and EN
- [ ] Target: 10 paying mosques in Montreal by month 6, then Ottawa and Toronto
- [ ] Advertiser outreach only once active members exceed ~2,000

---

## Timeline

| Weeks | Work |
| ----- | ---- |
| 1–2   | Section 0 and 1; request D-U-N-S on day one |
| 2–4   | Section 2 drafts |
| 2–7   | Sections 3, 4, 5 |
| 3–6   | Pilot mosques live on TestFlight / Play internal |
| 7–8   | Store submission, one rejection round |
| 9–10  | Public launch, first invoices |

## Budget

- Upfront: ~$1,500 CAD (incorporation, Quebec registration, developer accounts, domain, D-U-N-S is free)
- Monthly until revenue: $100–200 (Atlas, host, email, Sentry)
- Per transaction: Stripe 2.9% + 30¢, plus 0.25% + 25¢ per Connect payout
- Lawyer review of agreements and privacy policy: $1,500–3,000 one time

---

## Operator hand-off (needs accounts, not code)

The code reads all of these from the environment. Nothing below can be done from the repo.

- `apps/server/.env` from `.env.example`: `JWT_SECRET` (32+ random chars), `CORS_ORIGIN`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `PUBLIC_ADMIN_URL`, `SUPPORT_EMAIL`, `SUPERADMIN_*`
- Email: `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (or `SMTP_*`); SPF/DKIM/DMARC on the sending domain
- Storage: `S3_BUCKET`, `S3_ENDPOINT` (R2), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; webhook at `${PUBLIC_API_URL}/webhooks/stripe` with events `checkout.session.completed`, `checkout.session.expired`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `account.updated`; enable Connect (Express) and the customer portal; either Stripe Tax (`STRIPE_AUTOMATIC_TAX=true`) or fixed rates in `STRIPE_TAX_RATE_IDS`
- Sentry: `SENTRY_DSN` (API), `VITE_SENTRY_DSN` (console), `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_ORG`/`SENTRY_PROJECT` (app, as EAS secrets)
- Mobile: `eas init` → `EAS_PROJECT_ID`; `eas.json` → `ascAppId`, `appleTeamId`; APNs key via `eas credentials`; `apps/mobile/google-services.json`; `google-play-service-account.json`; real staging hostname in `eas.json`
- Website pages the emails and Stripe redirect to: `/reset-password`, `/billing/success`, `/billing/cancelled`, `/billing`, `/privacy`, `/terms` (the API also serves the legal text at `/api/legal/:kind`)
- Lawyer review of `apps/server/legal/*.md` before removing the DRAFT line
- Deploy per `infra/README.md`; tag `v1.0.0` to publish images to GHCR
