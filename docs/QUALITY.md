# Quality

"High quality" here is five properties a machine can check, not a claim in a
README. Each one has a gate that runs on every pull request, and each gate
fails loudly when the evidence disappears.

| Property | Gate |
| --- | --- |
| Every critical path tested | `docs/QUALITY.md` matrices + `bun run check:quality` |
| Every failure observable | structured logs + empty-catch audit in `scripts/check-quality.ts` |
| Every document executable | `bun run check:docs` |
| Every external dependency degradable | `docs/QUALITY.md` matrix + `tests/degradation.test.ts` |
| Every release reversible | `scripts/release.sh` gates + `infra/restore-rehearsal.sh` |

## 1. Every critical path tested

Each row names a path a resident, moderator or operator can take, the promise
that path makes, and the test that breaks if the promise does. The checker
confirms the file exists and still contains a test with that exact title, so a
rename cannot silently retire the promise.

<!-- quality:critical-paths -->
| Path | Promise | Evidence |
| --- | --- | --- |
| contribute-place | A resident submits a place that starts pending, is recorded in the audit trail, and a retry never creates a second copy. | `tests/submit-place.integration.test.ts` :: `a member submits a pending place, and the trail records it` |
| moderate-contribution | A moderator decides once, only inside their municipality, and the author is told. | `tests/moderation.integration.test.ts` :: `a place decision moves once, stays in scope, and tells the author` |
| consultation-loop | A resident opens a case, a neighbour supports it, the municipality answers it, and the author is notified. | `tests/consultations.integration.test.ts` :: `the municipality answers once, moves the case, and tells the author` |
| map-layer | The map draws the municipal outline and vector tiles, with pending places absent and neighbours clustered when zoomed out. | `tests/map-layer.integration.test.ts` :: `a close zoom carries the published place and never the pending one` |
| search-and-browse | Accents do not matter, a near-miss spelling still finds the place, and blocked or unpublished content stays out. | `tests/search.integration.test.ts` :: `a near-miss spelling finds the place, and an unpublished one stays hidden` |
| photo-lifecycle | Only the author can attach a pending photo, normalization strips metadata, and a failed finalization cleans its canonical object. | `tests/media-storage.integration.test.ts` :: `a failed finalization deletes its canonical object and can be retried` |
| directions-handoff | A destination opens in the map app the phone actually has, without a server key. | `tests/directions.test.ts` :: `iOS opens Apple Maps, which cannot be uninstalled` |
| weekly-report | The weekly report is a real PDF that carries its frozen figures and survives a name the font cannot draw. | `tests/report-pdf.test.ts` :: `the weekly report is a PDF that carries its figures and survives odd names` |
| account-deletion | Deleting an account removes what the person contributed, keeps what the institution answered, and is repeatable. | `tests/account-deletion.integration.test.ts` :: `deleting removes what the person contributed, keeps what the institution answered, and is repeatable` |
| offline-snapshot | The offline artifact contains first-party published data only, and a revoked version answers 410. | `tests/offline-snapshot.integration.test.ts` :: `revokes affected versions with 410 on abuse/privacy removal and pauses manifest until replacement succeeds` |
| residency-passport | A stamp needs a signed-in member, a close fix and a published place; retries create one encrypted stamp. | `tests/passport.integration.test.ts` :: `concurrent retries create one encrypted stamp and one audit` |
| safety-and-blocking | A report is scoped to the content's municipality, and blocking hides raw contributions from the blocker only. | `tests/safety.integration.test.ts` :: `blocking hides raw contributions from the blocker only and is reversible` |
| identity-and-staff | Staff procedures need a verified, session-bound second factor and stay inside the staff member's municipality. | `tests/staff-totp.integration.test.ts` :: `denies staff procedures without a verified staff session and grants session-bound access after TOTP or recovery code step-up` |
| notifications | Traffic fan-out needs explicit municipal and category consent and never copies unreviewed text. | `tests/native-notifications.integration.test.ts` :: `traffic fan-out requires explicit municipal/category consent and never copies unreviewed text` |
| platform-edges | Liveness, readiness, the crash sink and the artifact routes answer without hanging or storing personal data. | `tests/platform.integration.test.ts` :: `a client error is accepted, logged as one JSON line, and never stored` |
| production-invariants | A failed audit rolls back its mutation, and concurrent retries commit once. | `tests/production.integration.test.ts` :: `a failed audit rolls back its domain mutation and outbox` |
| province-data | The three municipalities match their official ONE codes and areas. | `tests/boundaries-data.test.ts` :: `carry exactly the three municipalities, by ONE P-code` |
| observability | Every log event is one parseable line, and personal data is redacted by field name and by shape. | `tests/log.test.ts` :: `fields that name personal data are redacted at any depth` |
| realtime-cap | One client cannot exhaust the realtime connection budget, and a released slot is reusable. | `tests/connection-limit.test.ts` :: `caps one client without affecting another` |

## 2. Every failure observable

The server writes JSON lines, one object per event, with a request ID that also
travels in the response header. The logger redacts sensitive field names and
sensitive shapes (email addresses and phone numbers), so a copied log line does
not become a second copy of personal data.

The rule that keeps it honest is mechanical. A `catch` block whose body is only
comments is a lost error unless it carries `// expected: <reason>`. The same
applies to `.catch(() => undefined)` and `.catch(() => {})`. The checker fails
the build on anything unmarked, so "we handled it" has to say why. The marker is
not a waiver for logging every expected condition; it is a prompt to decide
whether the reader should see it.

The mobile app reports a crash it survived to `/api/client-errors`, which
validates an 8 KB body, rate-limits it, and writes one sanitized log line with
no identity, coordinates or screen content. A field failure therefore reaches
the same log stream as a server failure.

## 3. Every document executable

`bun run check:docs` reads every Markdown file, including the historical
archives, and checks:

- every `bun run <name>` is a root script or an existing file;
- every fenced `bash`/`sh` block is valid shell after placeholders are written
  as shell values rather than angle-bracket redirections;
- every relative link resolves;
- every backticked repo path and migration number exists;
- every server env var the schema reads is documented in `.env.example`, and
  every documented var is read outside that file.

The result is that a handover guide cannot name a deleted script, a removed
variable or a shell snippet that fails before it does anything.

## 4. Every external dependency degradable

Each row is a provider the product can lose without losing the product. The
test runs the real module in a process configured to fail, not a mock.

<!-- quality:degradation -->
| Dependency | When | Behaviour | Evidence |
| --- | --- | --- | --- |
| Google Routes | No server key | Directions answer `SERVICE_UNAVAILABLE` with `reason: unavailable`; the app offers the map handoff instead. | `tests/degradation.test.ts` :: `routing without a key refuses the request and names the reason` |
| Expo Push | No access token | Delivery is skipped and the in-app notification remains. | `tests/degradation.test.ts` :: `push without a provider token is skipped, not failed` |
| Resend | No API key, log delivery off | Email fails safely instead of writing a sign-in link to the log. | `tests/degradation.test.ts` :: `email without a provider fails safely instead of logging a link` |
| S3 / SeaweedFS | Endpoint unreachable | Readiness reports `degraded` with `storage: false`; the process stays up. | `tests/degradation.test.ts` :: `readiness turns a dead object store into a degraded answer` |
| PostgreSQL | Unreachable | Readiness reports `degraded` with `database: false`; the process stays up. | `tests/degradation.test.ts` :: `readiness turns an unreachable database into a degraded answer` |
| Nominatim | `GEOCODER=none` | Address search returns no external results and says geocoding is off; place search still works. | `tests/degradation.test.ts` :: `a disabled geocoder returns no addresses and says so to the client` |
| Google Places photos | No server key | The thumbnail route answers 404 and the interface falls back to its own image. | `tests/degradation.test.ts` :: `a missing image-provider key leaves the thumbnail route at 404` |
| Realtime clients | Connection budget exhausted | New streams answer 429 with `retry-after`; existing streams keep their slots. | `tests/connection-limit.test.ts` :: `caps the process even when every client is within its own allowance` |

## 5. Every release reversible

A tag is the deployable unit. `scripts/release.sh` refuses to create one unless
the working tree is clean, the version is free, typecheck, lint, the unit
suite, the production build, the documentation gate and the quality gate all
pass. It prints the previous tag and the restore command when it finishes, so
the rollback path is in front of the operator at the moment it matters.

Migrations are forward-only. Rolling back therefore means restoring the backup
taken before the update, then checking out the previous tag. That path is
rehearsed against a real dump, not assumed:

```bash
BACKUP_DIR=/var/backups/ruta-cibao infra/backup.sh
infra/restore-rehearsal.sh
```

The rehearsal creates a throwaway database on the running Postgres, restores
the dump into it, checks that the schema and core tables are present, and drops
it. It never touches the configured database.

Rehearsal record:

| Date | Dump | Result |
| --- | --- | --- |
| 2026-10-29 | 1.3 MB `pg_dump -Fc` of the local stack, 9 member profiles | passed; schema and core tables present, throwaway database dropped |

Cut a release with:

```bash
scripts/release.sh 0.1.0
```

Add `RUN_RESTORE_REHEARSAL=1` when a recent dump is available and the local
stack is running, so the tag is cut only after the restore path has just
worked.

## Suite inventory

Every integration suite, and what it protects. A new suite that is not listed
here fails the quality gate.

| Suite | What it proves |
| --- | --- |
| `tests/account-deletion.integration.test.ts` | Erasure, ledger replay, last-admin guard |
| `tests/consultations.integration.test.ts` | Case opening, support, publication, answers, notifications |
| `tests/degradation.test.ts` | Provider loss, in isolated processes |
| `tests/map-layer.integration.test.ts` | Boundaries, tiles, clustering, tile validation |
| `tests/media-storage.integration.test.ts` | Photo reservation, normalization, publish, cleanup |
| `tests/moderation.integration.test.ts` | Decisions, scope, idempotency, notifications |
| `tests/native-notifications.integration.test.ts` | Devices, preferences, fan-out, ownership |
| `tests/offline-snapshot.integration.test.ts` | Artifact contents, revocation, manifest pause |
| `tests/passport.integration.test.ts` | Stamps, proximity, concurrency, archive |
| `tests/platform.integration.test.ts` | Health, readiness, crash sink, artifact routes |
| `tests/production.integration.test.ts` | Audit atomicity, concurrent retries, staff scope |
| `tests/safety.integration.test.ts` | Reports, blocking, visibility |
| `tests/search.integration.test.ts` | Fuzzy search, accents, categories, blocks |
| `tests/staff-totp.integration.test.ts` | Second factor, staff session, municipality scope |
| `tests/submit-place.integration.test.ts` | Submission, duplicates, idempotency, business details |

## Running the gates

```bash
bun run typecheck
bun run lint
bun run test
bun run check:docs
bun run check:quality
```

The integration suites need a disposable local database and object store:

```bash
docker compose --env-file .env -f infra/docker-compose.yml up -d postgres storage
DATABASE_URL=postgresql://ruta:ruta@localhost:5432/ruta_cibao_tests \
  S3_BUCKET=ruta-cibao-tests \
  bun run test:db
```

The storage suites also need the test bucket created once:

```bash
AWS_ACCESS_KEY_ID=minioadmin AWS_SECRET_ACCESS_KEY=minioadmin \
  AWS_ENDPOINT_URL=http://localhost:9000 S3_BUCKET=ruta-cibao-tests \
  CORS_ORIGIN='*' bun run scripts/init-storage.ts
```
