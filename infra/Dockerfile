# syntax=docker/dockerfile:1.7
# droast global ignore=DF033 reason="build context is the repo root, which has .dockerignore"
# droast global ignore=DF007 reason="full source tree is required by the build; .dockerignore trims it"

# Bun installs dependencies and runs project scripts. Next itself uses Node
# in both build and production; Bun's Node fallback breaks prerender validation.
# Debian supplies the glibc ABI that sharp's prebuilt binaries expect.

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
# Cache mount so a retry after a dropped connection resumes from what already
# downloaded instead of starting the whole tree again.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS builder
COPY --from=deps /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
# The workspace packages' own dependencies are linked under each package, not at the root.
COPY --from=deps /app/packages ./packages
COPY . .
# No application configuration is needed to build: `@/lib/env` validates lazily,
# so no secret is ever read at build time and none is baked into a layer.
#
# `NEXT_PUBLIC_*` is the exception, and it is not a preference — Next inlines
# these into the client bundle, so a value that arrives at runtime arrives too
# late and reads as `undefined` in the browser. Every one of them is therefore a
# build argument. Private credentials stay in the runtime environment and never
# appear here.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_IOS_URL=
ARG NEXT_PUBLIC_ANDROID_URL=
ARG NEXT_PUBLIC_SOURCE_URL=
# The staff desk's browser key: public by design and restricted by referrer.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_IOS_URL=${NEXT_PUBLIC_IOS_URL} \
    NEXT_PUBLIC_ANDROID_URL=${NEXT_PUBLIC_ANDROID_URL} \
    NEXT_PUBLIC_SOURCE_URL=${NEXT_PUBLIC_SOURCE_URL} \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
RUN bun run build \
    && find apps/web/.next/standalone -type d -name "*linuxmusl*" -prune -exec rm -rf {} +

# Bundle background and maintenance entrypoints independently of Next. Native
# packages remain external; copy their installed graph from the frozen lockfile.
FROM deps AS runtime-build
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/web/src ./apps/web/src
COPY scripts ./scripts
COPY apps/web/drizzle /migrations
# The scripts live outside the web workspace but import its dependencies. The installer keeps
# those under apps/web when another workspace pins a different version, so the scripts are given
# the same node_modules to resolve from.
RUN ln -s /app/apps/web/node_modules /app/scripts/node_modules \
    && bun build scripts/ops/init-storage.ts --target=bun --minify --outfile=/runtime/scripts/ops/init-storage.ts \
    && bun build scripts/ops/worker.ts --target=bun --minify \
      --outfile=/runtime/src/modules/jobs/worker.js --external=sharp --external=pg-native \
    && bun build apps/web/src/db/migrate.ts --target=bun --minify \
      --outfile=/runtime/apps/web/src/db/migrate.ts --external=pg-native \
    && bun build scripts/db/seed.ts scripts/db/import-boundaries.ts scripts/db/import-roads.ts scripts/ops/grant-staff.ts scripts/ops/apply-deletion-ledger.ts \
      --target=bun --minify --root=scripts --outdir=/runtime/scripts --external=pg-native \
    && bun run scripts/ops/runtime-notices.ts /runtime/THIRD-PARTY-NOTICES.txt \
    && bun run scripts/ops/prepare-runtime.ts /worker-dependencies sharp \
    && find /migrations/meta -type f ! -name _journal.json -delete \
    && for script in db/seed db/import-boundaries db/import-roads ops/grant-staff ops/apply-deletion-ledger; do \
         mv "/runtime/scripts/$script.js" "/runtime/scripts/$script.ts"; \
       done

# Migration and institutional maintenance scripts contain no native packages.
FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS migrator
WORKDIR /app
COPY --from=runtime-build /runtime/THIRD-PARTY-NOTICES.txt ./
COPY --from=runtime-build /runtime/apps/web/src/db/migrate.ts ./apps/web/src/db/migrate.ts
COPY --from=runtime-build /runtime/apps/web/src/db/migrate.ts ./src/db/migrate.ts
COPY --from=runtime-build /runtime/scripts ./scripts
COPY --from=runtime-build /app/scripts/db/sources/boundaries ./scripts/db/sources/boundaries
COPY --from=runtime-build /migrations ./drizzle
USER bun
CMD ["bun", "run", "apps/web/src/db/migrate.ts"]

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS storage-init
WORKDIR /app
COPY --from=runtime-build /runtime/THIRD-PARTY-NOTICES.txt ./
COPY --from=runtime-build /runtime/scripts/ops/init-storage.ts ./scripts/ops/init-storage.ts
USER bun
CMD ["bun", "run", "scripts/ops/init-storage.ts"]

FROM oven/bun:1.3.14-slim@sha256:d56a2534ffd262e92c12fd3249d3924d296d97086da773f821d7d0477435ea04 AS worker
WORKDIR /app
COPY --from=runtime-build /runtime/THIRD-PARTY-NOTICES.txt ./
COPY --from=runtime-build /runtime/src/modules/jobs/worker.js ./src/modules/jobs/worker.js
COPY --from=runtime-build /worker-dependencies ./node_modules
COPY packages/shared/messages ./packages/shared/messages
USER bun
CMD ["bun", "run", "src/modules/jobs/worker.js"]

FROM node:24-bookworm-slim@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --no-create-home nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=runtime-build /runtime/THIRD-PARTY-NOTICES.txt ./
# Next's own cache is the one writable path in a read-only container (a tmpfs
# in Compose). Created here so it belongs to the runtime user, not to root.
RUN mkdir -p /app/apps/web/.next/cache \
    && chown -R nextjs:nodejs /app/apps/web/.next/cache
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
