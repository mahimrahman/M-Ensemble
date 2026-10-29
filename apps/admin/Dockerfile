# syntax=docker/dockerfile:1.7
#
# The super-admin console: a static Vite build behind nginx. Build from the
# REPO ROOT (the console imports types from packages/shared):
#
#   docker build -f apps/admin/Dockerfile -t m-ensemble-admin .
#
# nginx also fronts the API for the console's own origin — `/api/`, `/uploads/`
# and `/webhooks/` are proxied to `API_UPSTREAM` (default `http://api:4000`, the
# compose service name). That is what lets the console call `fetch('/api/…')`
# with no CORS entry and no build-time API base, exactly as the Vite dev proxy
# does on a laptop. The upstream is substituted into nginx.conf at container
# start by the nginx image's own envsubst hook (`/etc/nginx/templates`).

ARG NODE_IMAGE=node:20-bookworm-slim

# ─── 1. Build ────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
# See apps/server/Dockerfile: `npm ci` wants every workspace the lockfile knows.
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
RUN npm ci --ignore-scripts \
      --workspace @m-ensemble/admin --workspace @m-ensemble/shared --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin
# `tsc -b && vite build` — the type check is part of the build on purpose.
RUN npm run build -w @m-ensemble/admin

# ─── 2. Serve ────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime
ENV API_UPSTREAM=http://api:4000
# The stock image renders every `templates/*.template` through envsubst into
# conf.d at start, substituting only variables that exist in the environment —
# so nginx's own `$uri`/`$host` survive untouched.
COPY apps/admin/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
