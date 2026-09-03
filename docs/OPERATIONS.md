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

## Secrets

Secrets live in `.env` on the host and nowhere else — not in the image, not in
the repository, not in a log line. To rotate one, edit `.env` and recreate the
affected container.

If a secret leaks, rotate it before anything else. For the JCE key, ask the
provider to revoke that specific key; other keys keep working.

## Planned

- Log aggregation and error tracking (Sentry, pino).
- Backup and restore, with a tested restore.
- The background worker: weekly reports, notification fan-out, traffic expiry,
  JCE retries.
