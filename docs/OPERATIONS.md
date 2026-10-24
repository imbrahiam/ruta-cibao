# Operations runbook

For whoever is on the other end when something breaks — including the
municipality after handoff.

## Health

| Check | Command | Healthy result |
| --- | --- | --- |
| App | `curl -fsS https://<host>/api/health` | `{"status":"ok",...}` |
| Containers | `docker compose -f infra/docker-compose.yml ps` | app and postgres `healthy` |
| Database | `docker compose -f infra/docker-compose.yml exec postgres pg_isready` | `accepting connections` |
| Extensions | `\dx` in psql | `postgis` and `vector` present |

## The app will not start

Startup validates the environment first, so read the first error line: it names
the variable and what was wrong with it. Compare against `.env.example`.

If the environment is fine, the next likeliest cause is Postgres refusing
connections — check `DATABASE_URL` and that the database container is healthy.

## A sign-in method is missing

On a production server, phone sign-in only appears when Twilio is configured
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`), and email sign-in
only when `RESEND_API_KEY` is set. The app says which is off at boot:

```bash
docker compose --env-file .env -f infra/docker-compose.yml --profile full logs app | grep '\[boot\]'
```

This is on purpose. The alternative — writing the code to the log — would let
anyone who can read the log sign in as anyone. `AUTH_LOG_DELIVERY=1` restores
the log route for a demo server with invented users only.

## Photo uploads fail

The phone uploads straight to storage, so the browser has to reach it:

1. Option B (SeaweedFS): `S3_ENDPOINT` must be the public `https://storage.<domain>`
   from `STORAGE_ADDRESS`, not `http://storage:9000`. `STORAGE_CORS_ORIGIN` must be
   the app's origin (or `*`).
2. Option A (R2/S3): the bucket's CORS rules must allow `PUT` from the app's
   origin.
3. An upload that reached storage but is refused when attached was checked and
   rejected: larger than 8 MB, or not really a JPEG, PNG or WebP. The object is
   deleted; the person sees the upload error and can try another photo.

## Warm Google place photos before a demo

App photographs take precedence. For published places already matched to Google,
warm the running web process's six-hour, memory-only photo cache with:

```bash
bun run scripts/warm-google-photos.ts http://localhost:3000
```

The script reads matched places from the public GeoJSON endpoint and requests
their thumbnail routes sequentially, waiting 1.5 seconds between requests. It
does not follow the redirects or print Google photo URLs. Its summary reports
HTTP 302 successes and other status counts. Run against the actual demo server:
a separate resolver process would not warm that server's cache, and each web
process has its own cache.

Google place IDs may remain in PostgreSQL; photo resource names and photo
capabilities are never persisted there. Google attribution is shown in native
place sheets and detail heroes; detail includes the author when already cached.
Successful no-photo results expire after ten minutes; provider and validation
errors never create a negative photo cache entry.
A provider 429 pauses uncached Google calls in that process for 60 seconds;
thumbnail requests then return HTTP 503 with `Retry-After: 60`, while valid
cached photos remain usable. Wait for the quota window before another warm-up
if its summary includes 503. Restarting the web process clears its photo cache.

## Migrations

```bash
docker compose -f infra/docker-compose.yml --profile migrate run --rm migrate
```

Re-running is safe. If a migration fails halfway, fix it forward with a new
migration rather than editing an applied one — the journal in `drizzle/` records
what has run, and rewriting history there desynchronises every other
environment.

## Cédula lookups are failing

The registry allows **50 uncached lookups per rolling hour, shared globally
across all API keys**. Cache hits are free and unlimited, so repeat lookups of
the same cédula never consume quota.

A failing lookup is not an outage for the user: onboarding degrades to
"verification pending" and retries later. Check, in order:

1. `JCE_USE_MOCK` — if it is `1`, no real lookups are happening at all.
2. A 429 in the logs means the hourly quota is spent. `reset_at` in the response
   says when it comes back.
3. A 401 means the API key is wrong or has been revoked.
4. A 500 or 502 is upstream. Nothing to do but let the retry job run.

Never re-query a cédula that has already resolved. The name is stored on the
profile; re-verifying spends shared quota for no new information.

## The background worker

One container, `worker`, running `scripts/worker.ts`. It owns the pg-boss schema
(`JOBS_SCHEMA`, default `pgboss`) in the same database as everything else, so
there is nothing extra to back up.

```bash
docker compose -f infra/docker-compose.yml --profile full logs -f worker
```

Every finished job logs one line with its queue, its id, how long it took and
what it returned, so "did the weekly report run" is answerable from the log
without opening the database.

**Nothing is running.** Check `JOBS_ENABLED`. At `0` the worker exits
immediately and says so, and the app runs every job in-process on the request
that caused it instead — which is correct but slower, and means no cron at all:
reports are never built and traffic reports never lapse.

**A schedule did not fire.** Schedules are re-registered on every boot, so
restarting the worker is the fix for a cron that was edited but not picked up.
`pgboss.schedule` holds what is currently registered.

**A job keeps failing.** pg-boss retries and then parks it. Every handler is
idempotent, so replaying one by hand is safe:

```sql
select name, state, output from pgboss.job
 where state in ('failed', 'retry') order by created_on desc limit 20;
```

**A weekly report is stuck at `pending`.** The row exists but the figures
failed. Re-running the job overwrites the same row — the upsert is keyed on
(municipality, week) — so there is no cleanup step first.

**A weekly report has no PDF.** The worker draws PDFs itself with `pdf-lib`
from the report's frozen figures; no browser is involved. A missing PDF means
the upload to object storage failed, so check the worker log for an S3 error
and the `S3_*` values in `.env`. Re-running the job regenerates it.

## Secrets

Secrets live in `.env` on the host and nowhere else — not in the image, not in
the repository, not in a log line. To rotate one, edit `.env` and recreate the
affected container.

If a secret leaks, rotate it before anything else. For the JCE key, ask the
provider to revoke that specific key; other keys keep working.

## Planned

- Log aggregation and error tracking (Sentry, pino).
- External uptime and backlog alerting on the recipient’s monitoring service.

Backup and restore are described in `DEPLOYMENT.md`, section 11.

## Readiness and retained work

`/api/health` checks the web process. `/api/ready` checks schema availability,
object storage and a worker heartbeat no older than two minutes. Alert on 503.
The worker drains `job_outbox` every five seconds; inspect unprocessed rows,
`attempts` and `next_attempt_at` when notification delivery is delayed.
Failed work remains durable and retries with backoff. External delivery is at
least once: a crash after provider acceptance can deliver a message twice.

Identity decisions attempt document deletion immediately. Hourly cleanup
retries failed deletions and expires requests waiting longer than 30 days.
`documents_purged_at` only records successful deletion of all objects.
Backups may retain earlier evidence until their own retention expires.

The intended domain is `rutacibao.com`. Domain purchase, DNS, private VPS,
production providers, encrypted disk volumes, off-host backups and monitoring
are the recipient’s resources. Rehearse the supplied Compose stack and restore
procedure on an isolated server before accepting real personal data.
