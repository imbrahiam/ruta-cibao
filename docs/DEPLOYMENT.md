# Deployment

The app is configured entirely through environment variables and ships as one
container image, so the same build runs in both targets below. Nothing is baked
into the image at build time except the `NEXT_PUBLIC_*` values, which Next
inlines.

`.env.example` is the complete list of variables. Every one of them is validated
at startup — a missing or malformed value fails the boot with a message naming
the variable, rather than surfacing later as a broken request.

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

docker compose -f infra/docker-compose.yml --profile full up -d --build
docker compose -f infra/docker-compose.yml logs -f app
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
