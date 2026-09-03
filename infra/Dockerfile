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
# NEXT_PUBLIC_* is the exception — Next inlines it — and is set by the deployer
# when the public origin differs from the runtime APP_URL.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
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
