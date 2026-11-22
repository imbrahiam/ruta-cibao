# Deploying Ruta Cibao

This guide is for the municipality's technical team. It assumes no contact with
the people who wrote the software. If you can administer a Linux server and
have used Docker before, you have everything you need here. Run every command
as written. Where a choice is yours to make, the guide says so and recommends
one.

Companion documents:

- `docs/OPERATIONS.md` — what to do when something breaks.
- `docs/NATIVE.md` — the native iOS and Android apps.
- `docs/ARCHITECTURE.md` — how the system is put together, for developers.

---

## 0. Status of this guide — read first

Every command below names a script, a container or a variable that exists in
the repository. The stack has not yet been rehearsed end to end on a clean
server. Before real residents' data goes in, someone outside the development
team must follow this guide on a fresh machine, without help, and the open
question below must be decided.

**Sign-in is by verified phone (Twilio Verify) or email (Resend).** No cédula
or identity document is collected. A municipal resident badge is optional and
granted in person by scoped staff; staff authority comes from
`scripts/ops/grant-staff.ts`; an authenticator code (TOTP) is asked of staff only when
`STAFF_STEP_UP_REQUIRED=1`, and is then enrolled before the role is granted. Passkeys are available
for staff on the web admin.

The intended public origin is `https://rutacibao.com`, subject to the domain
being purchased. Deliver the Docker images and Compose stack; deployment on the
recipient's private VPS does not require a hosted account owned by the developer.
Use a staging origin and an isolated database before the final launch.

The open question is the one in section 2.2: **which Google Maps key the
municipality owns**, or whether the iOS build uses Apple Maps instead. The
server runs without either; without one, the phone app cannot draw a map.

### 0.1 The contest demo (`demo.rutacibao.com`)

The demonstration is this same stack on its own host and database, not the
real service. Differences from section 6:

- `APP_URL`/`BETTER_AUTH_URL`/`NEXT_PUBLIC_APP_URL` are
  `https://demo.rutacibao.com`, and `DEMO_DEPLOYMENT=1` (validation refuses it
  on any host not starting with `demo.`).
- `LOCAL_DEMO_PHONES` (the fictional 809-555-01xx numbers from
  `scripts/db/seed-demo.ts`) and `LOCAL_DEMO_OTP` are set, so the presenter signs
  in without SMS and seeded staff skip TOTP. Real numbers and emails still go
  through Twilio Verify and Resend when those are configured.
- `APNS_*` are optional everywhere: without them iPhones get no push and the in-app inbox still works.
- Load content with `bun run db:seed`, the OSM import
  (`bun run scripts/db/import-osm-content.ts`) and `bun run scripts/db/seed-demo.ts`.

The demo phones run the native apps (`docs/NATIVE.md`) built against
`https://demo.rutacibao.com`.

What the code already guarantees, so you do not have to:

- The app and worker wait for migrations before they start.
- The photo bucket is created, private, on first start.
- On a production server, a missing SMS or email provider **disables** that
  sign-in method. It never writes codes or links to the log.
- `NODE_ENV=production` is fixed for every container, whatever `.env` says.
- Uploaded photos are checked before they are accepted: the uploader must be
  the person the upload was issued to, and the file must exist, fit the
  limit, and actually be a JPEG, PNG or WebP.
- Address search respects the public geocoder's limits (one request per
  second, no autocomplete, answers cached).
- A production boot refuses `TRUSTED_PROXY=0`, because behind Caddy every
  client would otherwise share one rate-limit bucket.

---

## 1. What you are deploying

```
               Internet (HTTPS)
                     │
             ┌───────▼────────┐
             │     Caddy      │  TLS certificates, automatic
             └───┬────────┬───┘
   app.<domain>  │        │  storage.<domain>   (only with self-hosted SeaweedFS)
         ┌───────▼──┐  ┌──▼──────┐
         │   app    │  │  SeaweedFS  │  photos, PDFs
         │ (Next.js)│  └─────────┘
         └────┬─────┘
              │        ┌──────────┐
              ├────────►  worker  │  scheduled jobs: weekly reports, expiry,
              │        └────┬─────┘  notifications, account deletion, snapshots
         ┌────▼─────────────▼──┐
         │ PostgreSQL 18        │  PostGIS + pgvector
         └──────────────────────┘
```

Seven containers, defined in `infra/docker-compose.yml`: `caddy`, `app`,
`worker`, `postgres`, `storage`, a one-shot `storage-init`, and a one-shot
`migrate`. They run on one server. The phone app is built separately and is not
served by this stack; see `docs/NATIVE.md`.

**The worker is not optional.** Without it, weekly reports are never produced,
traffic reports never expire, and account deletions and notification deliveries
sit in the outbox.

## 2. What you need before starting

### 2.1 A server

| | Minimum | Recommended |
| --- | --- | --- |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB (building the image uses ~3 GB) |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu Server 24.04 LTS | same |
| Network | Public IPv4, ports 80 and 443 open | same |

A VPS from any provider works. The server needs outbound internet access
during installation and for the external services below.

### 2.2 Decisions to make first

These are hard to change later. Decide them before you install anything.

1. **The permanent domain.** Passkeys (fingerprint/face sign-in) are tied to
   the exact hostname. Changing it later signs every passkey user out for
   good. Recommended: `rutacibao.do` or `app.rutacibao.do`, plus a separate
   `staging.` subdomain for testing.
2. **Where photos are stored.**
   - **A — managed S3-compatible storage (recommended).** Cloudflare R2, AWS
     S3, DigitalOcean Spaces, or a government cloud with an S3 API. Less to
     operate and back up.
   - **B — SeaweedFS on the same server.** No outside provider, but you back it
     up yourself and it needs its own subdomain (`storage.<domain>`).
3. **The phone map.** The app draws its map with Google Maps or, on iOS only,
   Apple Maps.
   - **Google (default, recommended for Android):** one key, billing enabled,
     restricted to the app bundle identifiers. No server key is needed for the
     map itself.
   - **Apple Maps on iOS:** no key and no bill, but it is iOS-only, so an
     Android build still needs Google.

### 2.3 Accounts the municipality must own

Open every account below **in the municipality's name, with an institutional
email**. Not a contractor's. Whoever owns these accounts controls the
platform.

| Service | Needed for | Required? |
| --- | --- | --- |
| Domain registrar (NIC.DO for `.do`) | The address | Yes |
| **Twilio** | Sign-in codes by SMS (the main way in) | **Yes** |
| **Resend** | Sign-in links and notifications by email | **Yes** |
| Object storage provider | Photos (option A only) | Option A |
| Google Cloud | Maps SDK key for the phone app | Yes for Android |
| Google Play Console | Android app listing (`docs/NATIVE.md`) | Optional |
| Apple Developer Program | iOS app listing (`docs/NATIVE.md`) | Optional |

Google Routes and Places are optional server features. Without
`GOOGLE_MAPS_SERVER_API_KEY`, in-app directions and Google photo fallback are
unavailable; the rest of the app still works.

### 2.4 DNS records

Create these at the registrar, pointing to the server's public IP. Wait until
they resolve before step 7:

| Type | Name | Value |
| --- | --- | --- |
| A | `app` (or `@`) | server IP |
| A | `storage` | server IP (option B only) |

For email (Resend shows the exact values when you add the domain): SPF, DKIM,
and a DMARC record such as `v=DMARC1; p=quarantine; rua=mailto:soporte@<domain>`.
Email from an unverified domain lands in spam.

---

## 3. Prepare the server

Log in over SSH as a user with `sudo`.

```bash
# Updates and automatic security patches
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git curl unzip
sudo dpkg-reconfigure -plow unattended-upgrades

# Firewall: SSH, HTTP, HTTPS only
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Docker Engine and the Compose plugin (official script)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
# Log out and back in so the group change applies, then:
docker compose version     # must print v2.x or later
```

Use SSH keys, not passwords, and disable password login in
`/etc/ssh/sshd_config` (`PasswordAuthentication no`).

## 4. Get the code

```bash
sudo mkdir -p /opt/ruta-cibao && sudo chown "$USER" /opt/ruta-cibao
cd /opt/ruta-cibao
git clone https://github.com/imbrahiam/ruta-cibao.git .
git checkout v0.1.0            # always deploy a tag, never an untested branch
```

### 4.1 One command alias

Every Compose command in this guide needs the same three options. If you
forget `--env-file .env`, a rebuild silently goes back to default settings —
the browser bundle would point at `http://localhost:3000`. Define this once:

```bash
echo "alias rc='docker compose --env-file /opt/ruta-cibao/.env -f /opt/ruta-cibao/infra/docker-compose.yml --profile full'" >> ~/.bashrc
source ~/.bashrc
```

From here on, `rc` means that full command.

## 5. Storage

### Option A — managed S3-compatible storage

1. Create a **private** bucket, for example `ruta-cibao`. No public access.
2. Create an access key limited to that bucket (read, write, delete).
3. Set the bucket's CORS rules so browsers can upload to it from the app's
   origin. Rule for AWS S3 and Cloudflare R2:

   ```json
   [
     {
       "AllowedOrigins": ["https://app.example.do"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. Note the endpoint, region, bucket name and keys for step 6. Use
   `S3_FORCE_PATH_STYLE=0` for AWS and R2.

### Option B — SeaweedFS on this server

Phones upload photos straight to storage, so SeaweedFS needs its own public
HTTPS address. Caddy already serves one: set `STORAGE_ADDRESS` in `.env` (step
6.2) and add its DNS record (2.4). Caddy gets the certificate, and the bucket
is created, private, on first start. Nothing to edit by hand.

SeaweedFS's own ports stay bound to `127.0.0.1`; Caddy reaches it inside
Docker's network.

## 6. Configuration

### 6.1 Create `.env`

```bash
cp .env.example .env
chmod 600 .env
```

`.env` holds every secret. It must never be committed, emailed or pasted into
a ticket.

Generate the secrets. Use hex for passwords, because they go inside a URL and
symbols break it:

```bash
openssl rand -base64 32     # BETTER_AUTH_SECRET
openssl rand -hex 32        # APP_ENCRYPTION_KEY
openssl rand -hex 24        # POSTGRES_PASSWORD
openssl rand -hex 24        # S3_SECRET_ACCESS_KEY (option B)
```

### 6.2 Values for production

Edit `.env`. Every variable is checked at startup, and a wrong value stops the
app with a message naming the variable. Example for `app.example.do`:

```bash
# --- Core: these three must be the same https origin ---------------------
NODE_ENV=production                     # the containers force this anyway
APP_URL=https://app.example.do
NEXT_PUBLIC_APP_URL=https://app.example.do
BETTER_AUTH_URL=https://app.example.do
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
TRUSTED_PROXY=1                         # Caddy sets X-Forwarded-For

# --- Read by docker compose, not by the app ------------------------------
SITE_ADDRESS=app.example.do             # Caddy requests the certificate for this
ACME_EMAIL=ops@example.do               # expiry warnings from Let's Encrypt
POSTGRES_USER=ruta
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_DB=ruta_cibao
# Compose builds DATABASE_URL from the three above; this line only matters
# for commands run outside Compose. Keep it consistent:
DATABASE_URL=postgresql://ruta:PASSWORD@postgres:5432/ruta_cibao

# --- Personal data -------------------------------------------------------
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)   # SEE SECTION 9.3 BEFORE GOING FURTHER

# --- SMS and email ----------------------------------------------------------
# Without them that sign-in method is switched off. Leave AUTH_LOG_DELIVERY=0.
TWILIO_ACCOUNT_SID=REPLACE_ME
TWILIO_AUTH_TOKEN=REPLACE_ME
TWILIO_VERIFY_SERVICE_SID=REPLACE_ME
RESEND_API_KEY=REPLACE_ME
EMAIL_FROM="Ruta Cibao <no-responder@example.do>"   # on the domain verified in Resend

# --- Push notifications --------------------------------------------------
APNS_KEY_ID=REPLACE_ME
APNS_TEAM_ID=REPLACE_ME
APNS_PRIVATE_KEY=REPLACE_ME
APNS_TOPIC=do.rutacibao.app
APNS_ENVIRONMENT=production

# --- Storage, option A (managed) -----------------------------------------
S3_ENDPOINT=https://ACCOUNT.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=ruta-cibao
S3_ACCESS_KEY_ID=REPLACE_ME
S3_SECRET_ACCESS_KEY=REPLACE_ME
S3_FORCE_PATH_STYLE=0

# --- Storage, option B (SeaweedFS) — instead of the block above --------------
# STORAGE_ADDRESS=storage.example.do
# STORAGE_CORS_ORIGIN=https://app.example.do  # the only origin allowed to upload
# S3_ENDPOINT=https://storage.example.do
# S3_REGION=us-east-1
# S3_BUCKET=ruta-cibao
# S3_ACCESS_KEY_ID=ruta-storage
# S3_SECRET_ACCESS_KEY=REPLACE_ME
# S3_FORCE_PATH_STYLE=1

# --- Address search ------------------------------------------------------
# "nominatim" uses OpenStreetMap's public geocoder within its usage policy
# (asked only on submit, cached, one request a second). For heavy use, run your
# own Nominatim and set NOMINATIM_URL, or "none" to search places only.
GEOCODER=nominatim

# --- Background jobs -----------------------------------------------------
JOBS_ENABLED=1
```

Leave `GOOGLE_MAPS_SERVER_API_KEY` and `IMGPROXY_*` empty unless you have set
those services up. `DEV_ORIGINS` is for development only. The native apps'
build settings live in their projects (`docs/NATIVE.md`), not on this server.

`NEXT_PUBLIC_*` values are built into the app. **Changing one requires a
rebuild** (`rc up -d --build`). For every other value, a restart is enough.

## 7. First start

```bash
cd /opt/ruta-cibao
rc up -d --build              # 5–15 minutes the first time
rc ps
```

The order is handled for you: Postgres and SeaweedFS start, `storage-init`
creates the bucket and exits, `migrate` applies the schema and exits, and only
then do `app` and `worker` start. After about a minute, `rc ps` should show
`app` as `healthy` and `migrate` / `storage-init` as `exited (0)`.

```bash
rc logs -f caddy              # watch it obtain the certificate(s), then Ctrl+C
rc logs app | grep '\[boot\]' # warnings about anything left unconfigured
```

The app writes one JSON object per line. A request carries `x-request-id` on
its response, and the same id appears on its `request.start` and `rpc.request`
lines, so a user report can be matched to a log entry without guessing.

## 8. Load the base data

The tables start empty. These commands fill them. Each is safe to run again,
and re-running is how you update the data.

```bash
rc run --rm migrate bun run scripts/db/seed.ts               # municipalities, categories
rc run --rm migrate bun run scripts/db/import-boundaries.ts  # exact OSM municipal relations
rc run --rm migrate bun run scripts/db/import-roads.ts       # road network (OpenStreetMap)
```

| If you skip | What stops working |
| --- | --- |
| `seed.ts` | No categories: nothing can be added or filtered |
| `import-boundaries.ts` | The location picker cannot name the municipality |
| `import-roads.ts` | Traffic reports cannot cover a whole street, only a point |

The road import downloads from Overpass and may be retried after a timeout.
Boundary import uses the reviewed GeoJSON in the repository. To refresh it
deliberately from OSM, run `bun run scripts/db/fetch-boundaries.ts`, review the
change, then import it.

**Never run `seed-demo.ts` in production.** It creates fake accounts that can
sign in. It refuses to run when `NODE_ENV=production`, which every container
sets.

## 9. Hand over the keys

### 9.1 The first moderator

There is no screen for appointing staff, on purpose. It's an act of the
institution, done from the server.

1. The person signs up in the app. The handover team checks their identity and
   residency in person, then uses the bootstrap command below to grant the
   first administrator.
2. On the server:

   ```bash
   rc run --rm migrate bun run scripts/ops/grant-staff.ts +18095551234 admin --approved-in-person
   # A moderator is confined to one municipality:
   rc run --rm migrate bun run scripts/ops/grant-staff.ts staff@example.do moderator --municipality REPLACE_ME
   # roles: moderator | admin | none     (none removes the role)
   ```

   Use their phone number, email or user id. The account must already exist
   with a verified phone or email. The script prints who now holds which role.
   An administrator requires the explicit `--approved-in-person` attestation;
   a moderator requires a municipality.

Keep a written record of who was given which role, when, and by whose
authority.

### 9.2 Third-party restrictions

- Google Maps mobile key: restrict it to the Android package
  `do.rutacibao.app` and the iOS bundle id `do.rutacibao.app`, and enable only
  the Maps SDKs. Set a monthly budget alert.
- Google server key (if used): restrict it to Routes API and Places API (New)
  and to the server's outbound IPs. Never ship it in the app.
- Twilio: set a spending limit, and enable geographic permissions only for the
  Dominican Republic.
- Resend: confirm SPF, DKIM and DMARC show as verified.

### 9.3 The encryption key — the one thing you cannot lose

`APP_ENCRYPTION_KEY` encrypts personal data at rest: push device tokens and the
account deletion inventory. **If it is lost, or changed, that data becomes
permanently unreadable**, and every affected account must re-register its
devices. Changing it is not "rotating a password".

- Store a copy of the whole `.env` **outside the server**: a password manager
  owned by the institution, or a sealed record held by two named officials.
- Never change `APP_ENCRYPTION_KEY` once real data exists.
- Backups (section 11) are useless without this key, and dangerous with it, so
  keep it stored **apart from** the backups.

## 10. Check the deployment

| Check | How | Expected |
| --- | --- | --- |
| Server responds | `curl -fsS https://app.example.do/api/health` | `{"status":"ok"}` |
| Dependencies | `curl -fsS https://app.example.do/api/ready` | `{"status":"ok",...}` |
| Production mode | `rc exec app printenv NODE_ENV` | `production` |
| Containers | `rc ps` | app healthy; worker, postgres, storage, caddy up |
| Worker | `rc logs --tail 50 worker` | Started, schedules registered, no errors |
| HTTPS | Open the site | Padlock, no warning; `http://` redirects |
| SMS sign-in | Sign in with a real phone | Code arrives by SMS; `rc logs app` does not contain it |
| Email sign-in | Sign in with an email | Link arrives in the inbox, not spam |
| Photo upload | Add a photo to a place | Photo shows; the object is in the bucket |
| Map | Open the phone app and pan | Map, labels and places draw |
| Boot warnings | `rc logs app \| grep '\[boot\]'` | Nothing, or only what you chose to leave off |
| Push | Send a notification from the admin panel | The phone receives it |
| Offline | Airplane mode, submit a place, reconnect | It stays queued in the app, then sends |

Do not announce the service until every row passes.

## 11. Backups and restore

Nothing is backed up until you set this up. Do it before real data arrives.

### 11.1 What to back up

| What | Where | How often |
| --- | --- | --- |
| Database | `postgres` container | Daily |
| Photos and PDFs | Bucket (option B: the `storage-data` volume) | Daily. Option A: use the provider's versioning/replication |
| `.env` and `infra/Caddyfile` | `/opt/ruta-cibao` | On every change, stored separately (9.3) |

### 11.2 The nightly script

`infra/backup/backup.sh` dumps the database and, when photos are in the local
SeaweedFS, copies the bucket. It keeps 14 days (`KEEP_DAYS`) in
`/var/backups/ruta-cibao` (`BACKUP_DIR`). It deliberately does **not** copy
`.env` (see 9.3).

```bash
sudo mkdir -p /var/backups/ruta-cibao && sudo chown "$USER" /var/backups/ruta-cibao
/opt/ruta-cibao/infra/backup.sh          # run once by hand and read the output
```

Schedule it with `crontab -e` (as the same user, who is in the `docker`
group):

```
30 3 * * * /opt/ruta-cibao/infra/backup.sh >> /var/backups/ruta-cibao/backup.log 2>&1
```

### 11.3 Off the server

A backup on the same server dies with the server. `infra/backup/backup-offsite.sh`
copies the local snapshots to a machine you name, with `rsync` over SSH:

```bash
export BACKUP_REMOTE=backup@files.example.do:/srv/ruta-cibao
/opt/ruta-cibao/infra/backup-offsite.sh
```

Put the same command after the nightly backup in the same crontab line, or in
a second line ten minutes later. Encrypt the remote volume, because the dump
contains personal data. `rclone` or `restic` work equally well if the
institution already runs one.

### 11.4 Restore — practise it

Restore once onto a **staging** server before launch, and then every three
months. An untested backup is not a backup.

`infra/backup/restore-rehearsal.sh` restores the newest local dump into a throwaway
database on the running Postgres and drops it afterwards. It touches no
production table and needs no downtime:

```bash
/opt/ruta-cibao/infra/restore-rehearsal.sh
```

A real restore replaces the database and objects. On a server set up through
step 7, with the **same `.env`** (same encryption key):

```bash
cd /opt/ruta-cibao
infra/backup/restore.sh /path/to/db-YYYY-MM-DD.dump \
                 /path/to/objects/objects-YYYY-MM-DD.tar   # second file: option B only
```

It asks you to type `RESTORE` before replacing anything, then stops the app,
restores, re-applies migrations and starts everything again.

Then sign in, open a place with photos, and confirm a signed-in account still
sees its own contributions. That last check proves the encryption key matches.

## 12. Updating to a new version

```bash
cd /opt/ruta-cibao
infra/backup/backup.sh                      # always first: migrations are one-way
git fetch --tags && git checkout v0.2.0
rc up -d --build                     # migrations run before the app starts
rc ps && curl -fsS https://app.example.do/api/ready
```

Read the release notes for new `.env` variables first. To compare:
`diff <(grep -o '^[A-Z_]*' .env.example | sort) <(grep -o '^[A-Z_]*' .env | sort)`.

**Rolling back.** Database migrations cannot be undone. Rolling back means
restoring the backup taken before the update (11.4), checking out the previous
tag, and rebuilding:

```bash
infra/backup/restore.sh /var/backups/ruta-cibao/db-TIMESTAMP.dump
git checkout v0.1.0
rc up -d --build
```

Never edit an applied migration file in `apps/web/drizzle/`. Migrations are
forward-only; a mistake is fixed by the next migration.

### 12.1 Cutting a release

On a development machine, with a clean tree, a running disposable database and
object store, and a recent backup:

```bash
DATABASE_URL=postgresql://ruta:ruta@localhost:5432/ruta_cibao_tests \
S3_BUCKET=ruta-cibao-tests \
BACKUP_DIR=/var/backups/ruta-cibao \
bun run scripts/ops/release.sh 1.2.3
git push origin main --follow-tags
```

The script runs the type, lint, database and storage, build, documentation and
quality checks, restores the newest backup into a throwaway database, then
creates an annotated tag `v1.2.3`. CI builds the images from that tag. A tag is
the thing you deploy and the thing you roll back to; a branch is not.

## 13. Day-to-day operation

- **Watch:** `rc ps`, `rc logs --since 1h app worker`, and disk space (`df -h`).
  A full disk stops the database. Container logs rotate at 10 MB × 5 files per
  service, so a chatty day cannot fill the disk on its own.
- **External monitoring:** point an uptime monitor at `/api/health` every
  minute, and at `/api/ready` every five. Alert the duty person on either.
  `health` proves the web process answers; `ready` proves the database, the
  object store and the worker heartbeat are all present.
- **Log search:** every line is JSON. Filter with `jq`, for example
  `rc logs app --since 1h | jq 'select(.level=="error")'`. Errors from the
  phone app arrive through `/api/client-errors` on the same stream.
- **Staging:** keep a second, smaller server at `staging.<domain>` with its
  own `.env` and keys. Apply every update there first, and rehearse the restore
  there.

## 14. Handover checklist

The service is handed over when the municipality can tick every line without
calling the developers:

- [ ] Every account in 2.3 is in the municipality's name.
- [ ] The repository, at the deployed tag, is in a repository the municipality
      controls.
- [ ] A copy of `.env` is stored outside the server, as in 9.3.
- [ ] Backups run nightly, are copied off the server, and a restore has been
      practised (11.4).
- [ ] A named person is responsible for the server and is on the uptime alert.
- [ ] Moderators are appointed (9.1), and the record of who holds each role is
      kept.
- [ ] Someone outside the development team has deployed staging from this
      guide alone.
- [ ] The open decision in section 0 is made and written down.

## Release checks and operational guarantees

- `bun run typecheck` generates Next route types before TypeScript runs.
- Run `bun run lint`, `bun run test:db`, `bun run check:docs`,
  `bun run check:quality` and `bun run build` before tagging.
- Apply every migration in `apps/web/drizzle/` before serving the new image. The
  migrator container does this automatically.
- Run database integration tests only against an isolated migrated database:
  `bun run test:db`.
- `/api/health` is liveness; `/api/ready` checks database tables, object
  storage and a worker heartbeat no older than two minutes. Alert on readiness
  failures.
- The worker drains `job_outbox` every five seconds. Failures remain pending and
  retry with backoff; delivery is at least once, so a crash after an external
  provider accepts a message can cause a repeat delivery.
- Temporary photo uploads expire after 24 hours. Accepted images are decoded,
  resized, stripped of metadata and copied to a server-written key; reusing an
  upload URL cannot replace an accepted image.
- Account deletion is requested in one transaction and carried out by a job.
  The receipt stays queryable until the cleanup finishes. Failed deletions are
  retried by the hourly cleanup. Encrypted backups can retain earlier data
  until their own retention expires; never describe deletion as immediate
  erasure of backups.
- `infra/backup/backup.sh` uses Compose to parse configuration and supports the actual
  SeaweedFS S3 service. Set `BACKUP_OBJECTS=0` only when objects are managed
  separately and their restore procedure has been tested. Keep every snapshot
  encrypted on disk and off-host, with keys kept separately.

The recipient must supply the purchased domain, DNS access, VPS, production
secrets, working SMS/email accounts, a Google Maps key or an Apple Maps
decision, an off-host backup destination, and an operator. Use encrypted host
volumes for database and storage (including names, email and phone stored by
Better Auth), and encrypted backup storage. The code alone cannot provision
those organizational resources.
