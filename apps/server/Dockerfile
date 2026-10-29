# syntax=docker/dockerfile:1.7
#
# The API image. Build from the REPO ROOT, not from this directory:
#
#   docker build -f apps/server/Dockerfile -t m-ensemble-api .
#
# Why the whole workspace is in here: `@m-ensemble/shared` is consumed as
# TypeScript *source* (see apps/server/src/shared.ts for the long version), so
# there is no emitted dist/ to copy. The server runs the sources under `tsx`,
# which is a runtime dependency for exactly that reason, and the image carries
# `packages/shared` next to `apps/server` the same way a checkout does.
#
# bookworm-slim rather than alpine: sharp's prebuilt libvips targets glibc, and
# the musl build is a second variant to go wrong on an image rebuild. 40MB more
# on disk is cheaper than a 3am "sharp: Could not load the sharp module".

ARG NODE_IMAGE=node:20-bookworm-slim

# ─── 1. Dependencies ─────────────────────────────────────────────────────────
# Manifests only, so this layer is cached until a package.json changes.
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
# The lockfile records every workspace; `npm ci` refuses to run if one it
# knows about is missing from disk. The manifests are enough — nothing from
# these two is installed.
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
# Production omits devDependencies. docker-compose.yml overrides this to "" for
# the local image, because with NODE_ENV=development the logger pretty-prints
# through `pino-pretty`, which is (correctly) a devDependency.
ARG NPM_FLAGS="--omit=dev"
# `--ignore-scripts` skips every package's install hook (nothing here needs
# one — sharp's binaries ship prebuilt as optional deps the lockfile pins).
RUN npm ci ${NPM_FLAGS} --ignore-scripts \
      --workspace @m-ensemble/server --workspace @m-ensemble/shared --include-workspace-root \
    && npm cache clean --force

# ─── 2. Runtime ──────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    # Posters go to S3 in production (assertProductionConfig insists), so this
    # directory is only ever written on a laptop running the image locally.
    UPLOAD_DIR=/app/apps/server/uploads
WORKDIR /app

# `curl` for the healthcheck and nothing else; `dumb-init` so SIGTERM from the
# orchestrator reaches node as PID 1 would and the graceful shutdown in
# index.ts actually runs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps --chown=node:node /app /app
COPY --chown=node:node package.json ./
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/shared ./packages/shared
COPY --chown=node:node apps/server ./apps/server
RUN mkdir -p /app/apps/server/uploads && chown node:node /app/apps/server/uploads

USER node
WORKDIR /app/apps/server
EXPOSE 4000

# `/api/health` answers 200 with the db state; a 503 means Mongo is unreachable
# and the orchestrator should stop routing to this replica.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/node_modules/.bin/tsx", "src/index.ts"]
