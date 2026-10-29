# Running M'Ensemble in production

Short and concrete. The long reasoning for each piece lives in the file it
describes (`apps/server/Dockerfile`, `docker-compose.prod.yml`,
`apps/server/.env.example`, `src/config/env.ts`).

## Shape

```
mobile app ──► https://api.mensemble.ca   ──► API container (Express, tsx)
Stripe     ──► https://api.mensemble.ca/webhooks/stripe        │
operators  ──► https://admin.mensemble.ca ──► nginx (console) ─┘ proxies /api
                                                  │
                        MongoDB Atlas (ca-central-1, Montréal) ◄┘
                        Cloudflare R2 / S3 for posters, served from cdn.mensemble.ca
```

Everything personal lives in Canada: Atlas in `ca-central-1`, the API host in a
Canadian region, R2 with a North America East location hint. Law 25 requires a
privacy impact assessment before any of it moves.

## Pick a host

| | Where | How |
|---|---|---|
| **Render** (simplest) | no Canadian region (closest: Ohio/Oregon). Only if the PIA accepts US hosting. | Web Service from image `ghcr.io/<owner>/m-ensemble-api:vX`, health path `/api/health`, env from the dashboard. Second Web Service from the admin image with `API_UPSTREAM` set to the API's internal URL. |
| **Fly.io** | `yyz` (Toronto) | `fly launch --image ghcr.io/<owner>/m-ensemble-api:vX --region yyz`, `fly secrets set` from `.env.example`. Second app for the admin image with `API_UPSTREAM=http://m-ensemble-api.internal:4000`. |
| **Railway** | no Canadian region today | same caveat as Render. |
| **A VPS** (OVH Beauharnois QC, DigitalOcean TOR1) | Canada | `docker-compose.prod.yml` + Caddy. The rest of this document assumes this path; the others are the same env and images. |

## First deploy (VPS)

1. **Atlas.** New project `m-ensemble-prod`, M10+ cluster in AWS `ca-central-1`.
   Database user `m-ensemble-api` (readWrite on `m_ensemble` only). Network
   access: the VPS's IP only. Turn on **Continuous Cloud Backup** (point-in-time).
2. **R2.** Bucket `m-ensemble-posters`, custom domain `cdn.mensemble.ca`, an
   API token scoped to that bucket. Steps are in `.env.example`.
3. **DNS** (Cloudflare, proxied off / "DNS only" for the two hosts so Caddy can
   complete the ACME challenge):
   - `api.mensemble.ca` A → VPS IP
   - `admin.mensemble.ca` A → VPS IP
   - `cdn.mensemble.ca` → R2 custom domain (Cloudflare does this)
   - Resend's DKIM/SPF records and a `_dmarc` TXT.
4. **The box.** Ubuntu 24.04, Docker Engine, a `deploy` user in the `docker`
   group, ufw allowing 22/80/443 only, unattended-upgrades on.
   ```sh
   sudo mkdir -p /srv/m-ensemble && sudo chown deploy /srv/m-ensemble
   cd /srv/m-ensemble
   git clone <repo> src          # only for docker-compose.prod.yml and infra/Caddyfile
   ln -s src/docker-compose.prod.yml . && ln -s src/infra .
   cp src/apps/server/.env.example api.env && chmod 600 api.env
   $EDITOR api.env               # fill in; the top block lists what production refuses to start without
   cat > .env <<EOF
   GHCR_OWNER=<github owner>
   IMAGE_TAG=v1.0.0
   API_HOST=api.mensemble.ca
   ADMIN_HOST=admin.mensemble.ca
   ACME_EMAIL=ops@mensemble.ca
   EOF
   echo <ghcr token> | docker login ghcr.io -u <user> --password-stdin
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   docker compose -f docker-compose.prod.yml logs -f api   # "listening on" and no "Refusing to start"
   ```
5. **Seed once.** `ALLOW_SEED_IN_PRODUCTION=true docker compose -f docker-compose.prod.yml run --rm api /app/node_modules/.bin/tsx src/scripts/seed.ts`,
   then remove the variable. Sign in to the console with `SUPERADMIN_EMAIL`.
6. **Stripe.** Live mode → Webhooks → endpoint `https://api.mensemble.ca/webhooks/stripe`
   with the seven events listed in `.env.example`; paste the signing secret into
   `api.env`; `up -d` to restart the API.
7. **Check.** `curl https://api.mensemble.ca/api/health` → `"db":"connected"`.
   Open the console, upload a poster, confirm the URL starts with
   `https://cdn.mensemble.ca/posters/`.

## Staging

A second copy of everything, different in these ways only:

- Atlas: **separate project** `m-ensemble-staging`, M0/M2 cluster, same region.
  A separate project (not a second cluster in the prod project) so a leaked
  staging credential cannot see production and the IP allowlists differ.
- Stripe: **test mode keys** (`sk_test_…`), a test-mode webhook endpoint
  pointing at `api.staging.mensemble.ca`.
- R2: bucket `m-ensemble-posters-staging`, domain `cdn.staging.mensemble.ca`.
- `SENTRY_ENVIRONMENT=staging`, `SUPERADMIN_EMAIL` a staging mailbox.
- Hosts `api.staging.` / `admin.staging.`; the same compose file with a
  different `.env`.

Every tag goes to staging first (`IMAGE_TAG=vX` there, `up -d`, click through
the console, make a test payment) and to production only after.

## Releases and rollback

`git tag v1.2.0 && git push origin v1.2.0` → `.github/workflows/deploy.yml`
pushes `m-ensemble-api:v1.2.0` and `m-ensemble-admin:v1.2.0` to GHCR. Nothing
deploys automatically.

**Deploy:** edit `IMAGE_TAG` in `/srv/m-ensemble/.env`, then
`docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
The API container must pass its healthcheck before the console is restarted.

**Roll back:** the same two commands with the previous tag. Takes under a
minute; every tag stays in GHCR. Database migrations are additive (Mongoose,
no schema drops), so the previous image always runs against the current data.

## Backups

Atlas Continuous Cloud Backup: snapshots every 6h kept 7 days, oplog for
point-in-time restore to any minute in the window.

**Test a restore every quarter** — a backup nobody has restored is a hope:

1. Atlas → cluster → Backup → pick a snapshot → *Restore* → **to a new
   cluster** `restore-test` in the staging project.
2. Point a laptop at it: `MONGODB_URI=<restore uri> npm run dev:server`, sign
   in, open a mosque, see yesterday's posts.
3. Delete `restore-test`. Note the date and how long it took in the ops log.

Posters are in R2, which is already replicated; a deleted object is gone, so
turn on **R2 object versioning** or a daily `rclone sync` to a second bucket.

## Secrets

- Live in `/srv/m-ensemble/api.env` (mode 600, owner `deploy`) and in the team
  password manager. Nowhere else — not in the repo, not in CI variables, not in
  Slack.
- CI holds only `GITHUB_TOKEN` (provided) and, once a deploy hook is enabled,
  whatever that one step needs (`DEPLOY_HOOK_URL` or an SSH key).
- Rotate on departure or suspicion: `JWT_SECRET` (signs everyone out),
  the Atlas user password, the R2 token, the Stripe restricted key, Resend key.
  Each is one env line and `up -d`.

## Incident runbook

**Paging.** Sentry → Alerts → "new issue in production" and "error rate >
1%/5min" → email + SMS to the on-call phone. Uptime check (Better Stack or
Atlas's own alerting) on `https://api.mensemble.ca/api/health` every minute →
same phone. On-call is whoever is named in the team calendar; the second name
is backup after 15 minutes.

**First five minutes.**
```sh
curl -s https://api.mensemble.ca/api/health          # db connected?
docker compose -f docker-compose.prod.yml ps          # containers healthy?
docker compose -f docker-compose.prod.yml logs --since 15m api | grep -v '"level":30'
```
Atlas → cluster → Metrics for connection count and slow queries.
Sentry issue → the release tag tells you whether this started with the last deploy.

**It started with the deploy** → roll back (above). Then investigate on staging.

**It is the database** → Atlas status page first. If Atlas is up and data is
wrong (bad migration, a destructive admin action): restore to the minute
before, **to a new cluster**, verify, then swap `MONGODB_URI` and `up -d`.
Never restore over the live cluster.

**It is a secret leak** → rotate in this order: Stripe key (Dashboard → roll),
Atlas password, `JWT_SECRET`, R2 token, Resend key. `up -d` after each. Check
the audit log in the console for actions you did not take.

**Afterwards.** A short write-up in `docs/incidents/YYYY-MM-DD.md`: timeline,
cause, what changed so it cannot recur. Within a week.
