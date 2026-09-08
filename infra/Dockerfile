# syntax=docker/dockerfile:1.7
# droast global ignore=DF033 reason="build context is the repo root, which has .dockerignore"
# droast global ignore=DF007 reason="full source tree is required by the build; .dockerignore trims it"

# Build with Bun (fast installs, matches local tooling), run on Node so the
# production image is the smaller, longer-supported runtime.

FROM oven/bun:1.3.14-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
# Cache mount so a retry after a dropped connection resumes from what already
# downloaded instead of starting the whole tree again.
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
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
# None is a secret. A browser maps key is restricted by referrer on the
# provider's side and a VAPID *public* key is public by definition; the private
# halves stay in the runtime environment and never appear here.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_MAP_RENDERER=google
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=
ARG NEXT_PUBLIC_MAPTILER_KEY=
ARG NEXT_PUBLIC_BASEMAP_PMTILES_URL=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_MAP_RENDERER=${NEXT_PUBLIC_MAP_RENDERER} \
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} \
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=${NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID} \
    NEXT_PUBLIC_MAPTILER_KEY=${NEXT_PUBLIC_MAPTILER_KEY} \
    NEXT_PUBLIC_BASEMAP_PMTILES_URL=${NEXT_PUBLIC_BASEMAP_PMTILES_URL} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
RUN bun run build

# Migrations need the TypeScript source and the drizzle/ folder, which the
# standalone runtime image deliberately does not carry. This stage keeps Bun and
# the full tree so `migrate` can run as its own one-shot container.
FROM oven/bun:1.3.14-alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY drizzle ./drizzle
USER bun
CMD ["bun", "run", "src/db/migrate.ts"]

# The worker runs the same TypeScript the app does, so it keeps Bun and the
# source tree rather than the standalone build — which contains only what the
# Next.js server needs and none of `scripts/`.
#
# PDFs are generated directly from frozen metrics with pdf-lib. The worker
# requires neither Chromium nor an authenticated request to the web app.
FROM oven/bun:1.3.14-alpine AS worker
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY messages ./messages
USER bun
CMD ["bun", "run", "scripts/worker.ts"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
