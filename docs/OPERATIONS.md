# Operations runbook

For whoever is on the other end when something breaks — including the
municipality after handoff.

## Health

| Check | Command | Healthy result |
| --- | --- | --- |
| Liveness | `curl -fsS https://<host>/api/health` | `{"status":"ok"}` |
| Readiness | `curl -fsS https://<host>/api/ready` | `{"status":"ok","checks":{"database":true,"storage":true,"worker":true}}` |
| Containers | `docker compose -f infra/docker-compose.yml ps` | app and postgres `healthy` |
| Database | `docker compose -f infra/docker-compose.yml exec postgres pg_isready` | `accepting connections` |
| Extensions | `\dx` in psql | `postgis` and `vector` present |

Liveness means the web process can answer. Readiness means the database, the
object store and a worker heartbeat within two minutes are all present. Alert
on both, and read the `checks` object to see which dependency is down.

## The app will not start

Startup validates the environment first, so read the first error line: it names
the variable and what was wrong with it. Compare against `.env.example`.

Two common refusals:

- `TRUSTED_PROXY` must be `1` on a non-local origin. Behind Caddy it sets
  `X-Forwarded-For`; without it every client shares one rate-limit bucket.
- `APP_URL`, `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` must be the same
  origin. A mismatch is rejected rather than half-working.

If the environment is fine, the next likeliest cause is Postgres refusing
connections — check `DATABASE_URL` and that the database container is healthy.

## A sign-in method is missing

On a production server, phone sign-in only appears when Twilio is configured
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`), and
email sign-in only when `RESEND_API_KEY` is set. The app says which is off at
boot:

```bash
docker compose --env-file .env -f infra/docker-compose.yml --profile full logs app | grep 'boot_'
```

This is on purpose. The alternative — writing the code to the log — would let
anyone who can read the log sign in as anyone. `AUTH_LOG_DELIVERY=1` restores
the log route for a demo server with invented users only.

## SMS codes are not arriving

Twilio Verify generates and checks the code, so the failure is almost always
account-side. Check, in order:

1. The Twilio console shows the Verify service as active, and
   `TWILIO_VERIFY_SERVICE_SID` matches it.
2. Geographic permissions allow the Dominican Republic.
3. The fraud guard blocked the destination, or the spending limit was reached.
4. The number is in E.164 form (`+1809…`). The app normalises it; a rejected
   number is shown to the person, not silently dropped.

A Twilio error is logged as one `sms.send_failed` line with the provider code
and no destination number. The person can retry; requesting a new code does not
reuse the previous one.

If the log says `sms.code_logged`, no provider is configured and the code went
to the log. That is development or a deliberate demo (`AUTH_LOG_DELIVERY=1`),
never production.

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

The log line is `places.photo_cleanup_failed` when a rejected upload could not
be removed from storage. It is retried by the cleanup sweep.

## Warm Google place photos before a demo

App photographs take precedence. For published places already matched to Google,
warm the running web process's six-hour, memory-only photo cache with:

```bash
bun run scripts/data/warm-google-photos.ts http://localhost:3000
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

## The background worker

One container, `worker`, running `scripts/ops/worker.ts`. It owns the pg-boss schema
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
reports are never built, traffic reports never lapse, and account deletions only
move when their request is retried.

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

**An account deletion is stuck.** `me.deletionStatus` reports `pending` until
the job finishes. Look for `account.deletion_inline_failed` (no worker) or the
`account.deletion` queue in `pgboss.job`. The request transaction already
revoked sessions and banned the account, so retrying is safe.

## Observability

Every response carries `x-request-id`. The same id appears on the request's
`request.start`, `rpc.request` or `api.request` line, and on any error line from
that request. Ask a user for the id shown in the error report, then:

```bash
docker compose --env-file .env -f infra/docker-compose.yml --profile full logs app --since 24h \
  | grep '"<request-id>"'
```

Logs are JSON, one object per line. `errorDetails` includes the stack; the
logger redacts fields whose names look personal (`phone`, `email`, `token`,
`secret`, `authorization`, `cookie`, `password`, `otp`, `session`, `cedula`,
`api_key`, `encryption`) and truncates long values.

Crashes and render failures in the phone app arrive at `/api/client-errors` and
are written as `client.error` lines with the same shape. The endpoint accepts
one bounded JSON body, rate-limits 30 reports per hour per client, and stores
nothing. A phone in the field therefore leaves a trace without a vendor SDK.

If the log stream itself is the problem (container restarting, no output), check
`rc ps` and the container's exit code first. `docker compose logs` reads the
rotated files; nothing older than five files per service is kept.

## Secrets

Secrets live in `.env` on the host and nowhere else — not in the image, not in
the repository, not in a log line. To rotate one, edit `.env` and recreate the
affected container.

If a secret leaks, rotate it before anything else. Twilio lets you revoke one
auth token; Resend and the storage provider do the same for their keys. Rotating
`APP_ENCRYPTION_KEY` is different: it makes existing ciphertext unreadable, so
read `DEPLOYMENT.md` section 9.3 first.

## Backup and restore

`infra/backup.sh` takes the nightly snapshot; `infra/backup-offsite.sh` mirrors
it to another machine; `infra/restore-rehearsal.sh` proves the newest snapshot
restores into a throwaway database. The full procedure, including the real
restore, is `DEPLOYMENT.md` section 11.

A backup is not verified until the rehearsal passes. Run it after changing
Postgres, the storage layout or the backup script.

## Planned

- External uptime and backlog alerting on the recipient’s monitoring service.
  The endpoints and log lines exist; the alert routing is institutional.

## Readiness and retained work

`/api/health` checks the web process. `/api/ready` checks schema availability,
object storage and a worker heartbeat no older than two minutes. Alert on 503.
The worker drains `job_outbox` every five seconds; inspect unprocessed rows,
`attempts` and `next_attempt_at` when notification delivery is delayed.
Failed work remains durable and retries with backoff. External delivery is at
least once: a crash after provider acceptance can deliver a message twice.

Account deletion removes the account, its contributions and its private storage
in a job. The receipt stays queryable until the job finishes. Failed deletions
are retried by the hourly cleanup. Encrypted backups may retain earlier data
until their own retention expires.

The intended domain is `rutacibao.com`. Domain purchase, DNS, private VPS,
production providers, encrypted disk volumes, off-host backups and monitoring
are the recipient’s resources. Rehearse the supplied Compose stack and restore
procedure on an isolated server before accepting real personal data.
