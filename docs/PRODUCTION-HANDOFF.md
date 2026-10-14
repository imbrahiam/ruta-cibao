# Production handoff — 2026-10-03

Current mobile/passport continuation: `docs/CONTINUATION.md` (2026-10-13).
The preview launcher below describes the earlier review environment.

## Current preview

Local URL: http://localhost:3210. Fictional seeded accounts:

- Admin: `8095550101`, code `123456` (Altagracia Peña).
- Citizen: `8095550102`, code `123456` (Franklin Rodríguez).

Select phone sign-in and request a code first. These are passwordless accounts.
The fixed code applies only in development, with localhost APP_URL, mock JCE,
and an explicit phone allowlist. Production startup rejects the demo settings.
Normal OTP expiry, five attempts and single-use consumption remain in place.

The running preview uses the existing QA PostgreSQL service on port 55432,
a separate `ruta_cibao_demo` database, and the review storage service on 59001.
The local-only launcher is `/tmp/ruta-cibao-demo.sh`; its values are fictional.
Restart from this repository with:

```sh
/tmp/ruta-cibao-demo.sh node node_modules/next/dist/bin/next dev --hostname localhost --port 3210
```

Dependencies were installed with Bun. Next runs under Node for this preview;
the initial Bun/127.0.0.1 launch produced a locale rewrite redirect loop.
No live registry lookups, SMS, email or model downloads are used.

## Docker work completed

- Separate minimal web, worker, migrator and storage initialization targets.
- Worker bundles business jobs with only required native Sharp dependencies.
- Migrator contains bundled database/admin/import scripts and forward-only SQL; no application dependency tree or migration snapshots.
- Pinned runtime/base images, deterministic installs, third-party license notices, smaller build contexts.
- Read-only runtime filesystems, tmpfs where required, dropped capabilities, non-root application processes.
- CI builds five targets and checks image size budgets. Latest CI workflow has not run remotely.

Measured compressed OCI image sizes on ARM64: web 183 MB, worker 77 MB,
migrator 44 MB, storage initialization 44 MB. (A maintenance-tools image for
the assistant's embeddings existed then; it was removed with the assistant.)
Before optimization worker and migrator were approximately 510 MB each.
Docker's unpacked local disk footprint is larger than these transfer sizes.
AMD64 web and worker builds/startup were also verified.

## Validation already completed

- Typecheck, lint and production build passed before the final local demo changes.
- Unit suite: 139 passed; opt-in integration tests skip in the default run.
- Database integration: five passed; private storage integration: one passed.
- Browser suite: eight passed, including identity submission, evidence access, approval and purge.
- Fresh PostgreSQL 18/PostGIS/vector image and forward migrations verified.
- Database dump restored into an isolated database successfully; full backup/restore scripts still need a production rehearsal including storage.
- droast reported no findings for both Dockerfiles.
- ARM64 and AMD64 web/worker readiness verified.

Final changes to context exclusions, migrator read-only Compose configuration,
CI image budgets and development login should go through CI before release.

## Application work carried forward

Encrypted identity evidence and durable registry results; shared rolling quota;
identity moderation and citizen UI/catalog; transactional job outbox and worker
heartbeat; scoped audited evidence access and retention; validated normalized
photo uploads with reservation/expiry/replay protection; readiness endpoint;
backup/restore scripts and staff bootstrap documentation.
The working tree contains earlier user work too: do not blanket revert it.
Nothing was committed, published or deployed.

## Before a public deployment

1. Buy the chosen domain (current preference: rutacibao.com), provision the VPS,
   configure DNS, production origins and TLS with the supplied Caddy/Compose setup.
2. Supply real secrets through deployment configuration; configure SMS/email,
   push and any optional OAuth provider. Remove all demo settings.
3. Bootstrap a real administrator; seed only intended public content.
4. Rehearse encrypted offsite database/object-storage backup and full recovery.
5. Run CI and production browser checks on the real HTTPS origin, including
   camera, uploads, passkeys, push and provider delivery.
6. Establish monitoring, disk/backup retention and recovery ownership.

## Disk hygiene

Review web/worker/database containers and all review image tags were removed.
Build cache was pruned by the specific IDs created during this review (23.53 GB
reported reclaimed). Existing QA services and repository assets were preserved.
The small storage container remains necessary for the local preview. The old
production `.next` output was removed; only active development output is needed.
No additional images or model weights should be downloaded for this preview.

Final local verification: both phone accounts requested and consumed `123456`
successfully (HTTP 200); typecheck and lint passed. Review-only test databases,
Playwright browser revisions installed during this review, and test reports
were removed. The local demo database remains.
