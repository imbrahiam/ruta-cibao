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

**The PDF button does nothing.** Expected unless Chromium is installed in the
worker image; the report itself is unaffected and the page still prints from a
browser. See the `worker` stage in `infra/Dockerfile` to turn it on.

## Secrets

Secrets live in `.env` on the host and nowhere else — not in the image, not in
the repository, not in a log line. To rotate one, edit `.env` and recreate the
affected container.

If a secret leaks, rotate it before anything else. For the JCE key, ask the
provider to revoke that specific key; other keys keep working.

## Planned

- Log aggregation and error tracking (Sentry, pino).
- Backup and restore, with a tested restore.
