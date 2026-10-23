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
COPY apps/mobile/package.json ./apps/mobile/package.json
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
COPY . .
# No application configuration is needed to build: `@/lib/env` validates lazily,
# so no secret is ever read at build time and none is baked into a layer.
#
# `NEXT_PUBLIC_*` is the exception, and it is not a preference — Next inlines
# these into the client bundle, so a value that arrives at runtime arrives too
# late and reads as `undefined` in the browser. Every one of them is therefore a
# build argument, which is what makes "changing an env value" enough to point a
# deployment at a different maps key or switch the renderer.
#
# Public browser map values are restricted by referrer; private credentials
# stay in the runtime environment and never appear here.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_IOS_URL=
ARG NEXT_PUBLIC_ANDROID_URL=
ARG NEXT_PUBLIC_SOURCE_URL=
ARG NEXT_PUBLIC_MAP_RENDERER=maplibre
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
ARG NEXT_PUBLIC_RASTER_TILE_URL=
ARG NEXT_PUBLIC_RASTER_TILE_ATTRIBUTION=
ARG NEXT_PUBLIC_MAPTILER_KEY=
ARG NEXT_PUBLIC_BASEMAP_PMTILES_URL=
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_IOS_URL=${NEXT_PUBLIC_IOS_URL} \
    NEXT_PUBLIC_ANDROID_URL=${NEXT_PUBLIC_ANDROID_URL} \
    NEXT_PUBLIC_SOURCE_URL=${NEXT_PUBLIC_SOURCE_URL} \
    NEXT_PUBLIC_MAP_RENDERER=${NEXT_PUBLIC_MAP_RENDERER} \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} \
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID} \
    NEXT_PUBLIC_RASTER_TILE_URL=${NEXT_PUBLIC_RASTER_TILE_URL} \
    NEXT_PUBLIC_RASTER_TILE_ATTRIBUTION=${NEXT_PUBLIC_RASTER_TILE_ATTRIBUTION} \
    NEXT_PUBLIC_MAPTILER_KEY=${NEXT_PUBLIC_MAPTILER_KEY} \
    NEXT_PUBLIC_BASEMAP_PMTILES_URL=${NEXT_PUBLIC_BASEMAP_PMTILES_URL}
RUN bun run build \
    && find apps/web/.next/standalone/node_modules/@img -maxdepth 1 -type d -name "*linuxmusl*" -exec rm -rf {} +

# Bundle background and maintenance entrypoints independently of Next. Native
# packages remain external; copy their installed graph from the frozen lockfile.
FROM deps AS runtime-build
COPY tsconfig.json ./
COPY packages ./packages
COPY apps/web/src ./apps/web/src
COPY scripts ./scripts
COPY data/boundaries ./data/boundaries
COPY drizzle /migrations
RUN bun build scripts/init-storage.ts --target=bun --minify --outfile=/runtime/init-storage.ts \
    && bun build scripts/worker.ts --target=bun --minify \
      --outfile=/runtime/src/modules/jobs/worker.js --external=sharp --external=pg-native \
    && bun build apps/web/src/db/migrate.ts --target=bun --minify \
      --outfile=/runtime/apps/web/src/db/migrate.ts --external=pg-native \
    && bun build scripts/seed.ts scripts/import-boundaries.ts scripts/import-roads.ts scripts/grant-staff.ts scripts/apply-deletion-ledger.ts \
      --target=bun --minify --outdir=/runtime/scripts --external=pg-native \
    && bun run scripts/runtime-notices.ts /runtime/THIRD-PARTY-NOTICES.txt \
    && bun run scripts/prepare-runtime.ts /worker-dependencies sharp \
    && find /migrations/meta -type f ! -name _journal.json -delete \
    && for script in seed import-boundaries import-roads grant-staff apply-deletion-ledger; do \
         mv "/runtime/scripts/$script.js" "/runtime/scripts/$script.ts"; \
       done

# Migration and institutional maintenance scripts contain no native packages.
FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS migrator
WORKDIR /app
COPY --from=runtime-build /runtime/THIRD-PARTY-NOTICES.txt ./
COPY --from=runtime-build /runtime/apps/web/src/db/migrate.ts ./apps/web/src/db/migrate.ts
COPY --from=runtime-build /runtime/apps/web/src/db/migrate.ts ./src/db/migrate.ts
COPY --from=runtime-build /runtime/scripts ./scripts
COPY --from=runtime-build /app/data/boundaries ./data/boundaries
COPY --from=runtime-build /migrations ./drizzle
USER bun
CMD ["bun", "run", "apps/web/src/db/migrate.ts"]

FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS storage-init
WORKDIR /app
COPY --from=runtime-build /runtime/THIRD-PARTY-NOTICES.txt ./
COPY --from=runtime-build /runtime/init-storage.ts ./scripts/init-storage.ts
USER bun
CMD ["bun", "run", "scripts/init-storage.ts"]

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
