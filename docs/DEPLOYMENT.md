# Deployment

The app is configured entirely through environment variables and ships as one
container image, so the same build runs in both targets below. Nothing is baked
into the image at build time except the `NEXT_PUBLIC_*` values, which Next
inlines.

`.env.example` is the complete list of variables. Every one of them is validated
at startup — a missing or malformed value fails the boot with a message naming
the variable, rather than surfacing later as a broken request.

The one distinction worth knowing: `NEXT_PUBLIC_*` values are **build**
arguments, because Next inlines them into the client bundle. Changing the maps
key or the renderer therefore needs a rebuild (`up -d --build`), not a restart.
Everything else is read at runtime and a restart is enough.

## Target 1 — VPS with Docker Compose

What runs: Caddy (TLS), the app, a one-shot migration container, Postgres with
PostGIS and pgvector, and MinIO for uploads.

The Postgres image is built from `infra/postgres/Dockerfile` rather than pulled,
because no published image ships PostGIS and pgvector together. The first
`up --build` on a host takes a few minutes for that.

```bash
git clone <repo> && cd ruta-cibao
cp .env.example .env            # fill in real values
$EDITOR .env

# Point Caddy at the domain. Leave it as localhost for a plain-HTTP test.
export SITE_ADDRESS=rutacibao.example.do

# `--env-file .env` matters: the NEXT_PUBLIC_* values are build arguments, and
# Compose interpolates those from the file given here rather than from the
# `env_file:` each service reads at runtime.
docker compose --env-file .env -f infra/docker-compose.yml --profile full up -d --build
docker compose --env-file .env -f infra/docker-compose.yml logs -f app
```

The `migrate` service runs to completion and exits; that is expected. Re-running
it against an up-to-date database is a no-op, so it is safe to leave in the
startup path.

Caddy provisions and renews the certificate automatically once `SITE_ADDRESS` is
a real domain with an A record pointing at the host. Ports 80 and 443 must be
reachable for the ACME challenge.

To update:

```bash
git pull
docker compose -f infra/docker-compose.yml --profile full up -d --build
```

The app container runs read-only, drops all capabilities and cannot gain new
privileges. Postgres and MinIO are bound to `127.0.0.1`, so only Caddy and the
app reach them.

## Target 2 — Railway

Railway replaces Caddy, Postgres and MinIO with managed equivalents:

1. Create a Postgres service **whose image has PostGIS and pgvector available**
   — the stock Railway Postgres does not. Use their PostGIS template, or deploy
   `infra/postgres/Dockerfile` as a service with a volume. Then enable them:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
   `bun run db:migrate` also does this, but running it by hand first confirms
   the plan allows the extensions before you deploy.
2. Add the app service from this repo with `infra/Dockerfile` as the build.
3. Set every variable from `.env.example`. `DATABASE_URL` comes from the
   Postgres service; `APP_URL`, `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` are
   the Railway domain.
4. Run migrations once per deploy, either as a release command or by running
   `bun run src/db/migrate.ts` in a one-off shell.
5. For uploads, attach a volume or point the storage adapter at S3/R2 — MinIO is
   the self-hosted default, not a requirement.

## First run — the data the app cannot invent

Migrations create the tables; three one-off loads fill the ones whose contents
come from outside. Each is idempotent, so re-running is how you update rather
than something to avoid.

```bash
bun run db:seed          # municipalities, the taxonomy, a few landmarks
bun run db:boundaries    # municipal polygons (geoBoundaries, CC-BY 4.0)
bun run db:roads         # the province's road network (OpenStreetMap, ODbL)
```

They are separate from `db:migrate` because they are content, not schema, and
because each one reaches a third party: a deploy should not fail because
Overpass was busy. Skipping one degrades a specific thing rather than breaking
the app —

| Skipped | What stops working |
| --- | --- |
| `db:seed` | No categories, so nothing can be submitted or filtered |
| `db:boundaries` | The picker cannot name a municipality; the server still checks the point on submit |
| `db:roads` | Traffic reports fall back to a point; the street picker says so |

In Compose these run from the `migrate` image, which carries the source tree:

```bash
docker compose -f infra/docker-compose.yml run --rm migrate bun run db:seed
docker compose -f infra/docker-compose.yml run --rm migrate bun run db:boundaries
docker compose -f infra/docker-compose.yml run --rm migrate bun run db:roads
```

To see the app with a province's worth of activity in it — reports on the roads,
cases with replies, businesses claimed — there is `bun run db:seed:demo`. It
invents sign-in-able accounts and refuses to run with `NODE_ENV=production`.

## The worker

The `worker` service is not optional in production. Without it there is no cron:
weekly reports are never built, traffic reports never lapse, the JCE retry queue
never drains and nothing sweeps expired rows.

```bash
docker compose -f infra/docker-compose.yml --profile full logs -f worker
```

`JOBS_ENABLED=0` is the deliberate way to run without one — the app then does
each job in-process on the request that caused it, which is right for a
single-container demo and wrong for a deployment that has to produce a report on
a Monday morning. See OPERATIONS.md.

## Verifying a deployment

```bash
curl -fsS https://<host>/api/health        # {"status":"ok","time":"..."}
curl -fsS https://<host>/api/spec.json | head
open https://<host>/api/docs
```

The app container also has a Docker healthcheck on `/api/health`, so
`docker compose ps` shows `healthy` once it is serving.

## Backups

**Planned.** Nightly `pg_dump` plus a MinIO bucket sync, with the restore
procedure written down and tested in `OPERATIONS.md`. Do not go live without it.
