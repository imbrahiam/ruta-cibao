# Ruta Cibao

Civic map for the province of Santiago Rodríguez, Dominican Republic — Sabaneta,
Monción and Villa Los Almácigos. Residents and visitors share places,
businesses, routes, traffic reports and public consultations on one map; the
municipality moderates them from a web admin panel and gets a weekly PDF report.

Built for the FUNDESER **TechEmprende SR Conecta 2026** contest. MIT licensed.

## What's in the repo

| Path | What it is |
| --- | --- |
| `apps/ios` | The citizen app for iPhone — SwiftUI |
| `apps/android` | The citizen app for Android — Jetpack Compose |
| `packages/kmp` | Kotlin Multiplatform core shared by both apps (API client, data, view models) |
| `apps/web` | Next.js 16: the API, the admin panel, the landing and share pages |
| `packages/contracts` | oRPC contracts shared by the API and the app |
| `packages/shared` | Shared code and the Spanish text catalogue (`messages/es.json`) |
| `infra` | Docker Compose stack: Postgres (PostGIS), SeaweedFS, Caddy |
| `scripts` | Seeding, OSM and boundary imports, the background worker |

Stack: Bun, TypeScript, PostgreSQL 18 + PostGIS via Drizzle, oRPC v2 (typed
RPC plus a public OpenAPI API), Better Auth with phone (Twilio Verify) or email
(Resend) sign-in, Biome.

## Run it locally

You need [Bun](https://bun.sh) and Docker.

```bash
cp .env.example .env                              # fill in the values
bun run services:up                               # Postgres + storage (Docker)
bun install
bun run db:migrate
bun run db:seed && bun run db:seed:demo           # optional demo content
bun run dev                                       # landing + API + admin on :3000
```

- Landing: <http://localhost:3000/>
- Admin panel (authorized staff only): <http://localhost:3000/admin>
- API reference: <http://localhost:3000/api/docs>

### Web-only preview

With dependencies installed and `.env` configured, run `bun run dev` from the
repository root. This starts only Next.js, not the background worker or
Docker services. The public landing can be inspected without the native apps;
database-backed requests still need Postgres.

### Which surface does what?

| Surface | Purpose |
| --- | --- |
| `/` | Public landing introducing the mobile app; not an interactive web map or an admin dashboard |
| `/experience`, `/territory`, `/download` | Dedicated product, province and app-distribution pages in the same public design system |
| `/admin` | Municipal staff workspace; anonymous visitors see sign-in, and signing in does not grant a staff role |
| `/s/[kind]/[ref]` | Public shared detail pages for places, routes, consultations and traffic notices |
| `/privacy`, `/terms`, `/support`, `/account/delete` | Public privacy, terms, support and account-deletion pages |
| `apps/ios`, `apps/android` | Citizen experience, including the interactive map and community participation |

Public URLs and section anchors use English. Main calls to action navigate to
`/experience`, `/territory` and `/download`; homepage section anchors remain
available for direct reading. Visible interface copy remains Spanish.

The landing describes six product capabilities: places and services on a map,
local businesses, routes, traffic notices, consultations with municipal follow-up,
and weekly municipal PDF reports. These sections describe the product; they are
not six tools embedded in the landing.

### Staff workspace

The municipal workspace organizes moderation of places, business claims, photos,
corrections, routes, traffic and content reports, plus consultation follow-up,
weekly reports and administrator-only categories. These sections support the same
citizen-facing features rather than a second public map.

The workspace uses a grouped, collapsible sidebar, a contextual topbar and shared
page headers, filter bars and table frames. `apps/web/src/components/admin/nav.ts` owns the
section registry, pending-count bindings and the consultation-queue alias.
Desktop collapse is remembered in an `/admin`-scoped UI cookie. Mobile navigation
uses a native modal dialog with focus trapping, Escape dismissal and visible focus
restoration when crossing back to desktop.

The sidebar and breadcrumbs remember each list's URL filters for the current
authenticated workspace. Detail headings publish their title through the page
context, so breadcrumbs return to the filtered list rather than a separate back
button. Existing moderation controls and English route paths remain unchanged.

`apps/web/src/components/admin/list-queries.ts` supplies the same typed query options to list
screens and intent-based prefetching. Sidebar and overview links warm routes and
data on pointer, keyboard focus or touch. Query freshness stays at 15 seconds,
with focus refetch and no automatic mutation retries. Empty municipality filters
are normalized once; a moderator's single assigned municipality takes precedence.

`AdminShell` requires a verified staff member with an authorized scope before
mounting protected navigation or queries. Successful sign-out clears and replaces
the query client and remounts its observers, isolating subsequent accounts and late
callbacks. A reported sign-out failure keeps the current client and displays an error.

The existing ink/paper palette, editorial typography and automatic system dark
mode are retained. Shared opaque lavender selection tokens keep selected text
readable even inside dark buttons.

Browser smoke checks covered all 11 administrative sections, desktop collapse
persistence, mobile dialog focus and breakpoint transitions, light/dark layouts,
empty municipality filters, consultation and report breadcrumbs, and preserved
list filters. Photo and consultation intent prefetches were reused on navigation.
Sign-out removed protected navigation; the moderator session hid Categories and
refused its direct URL without requesting catalog data. No moderation decisions
or report generation were performed.

### Identity

Vínculo is the identity: two links of a chain on forest green (`#28594a`).
`packages/shared/src/brand.ts` supplies its geometry and colors to the web logo;
the iOS app draws the same paths in `MarkLinks`. The browser icon and the staff
desk use `apps/web/public/brand/mark.svg`.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` / `build` | Web server / production build |
| `bun run worker` | Background jobs |
| `bun run services:up` / `services:down` | Local Postgres and object storage (Docker) |
| `bun run check` | Typecheck, lint, docs, quality gates and unit tests in one go |
| `bun run typecheck` / `lint` / `lint:fix` | TypeScript / Biome (`lint:fix` also formats) |
| `bun run test` | Unit tests |
| `bun run test:db` | Every suite, against a throwaway `<db>_tests` database and `<bucket>-tests` bucket |
| `bun run check:docs` / `check:quality` | Docs that name missing things / the quality matrix |
| `bun run db:generate` / `db:migrate` / `db:studio` | Write / apply / browse migrations and data |
| `bun run db:seed` / `db:seed:demo` | Base catalogue / demo accounts and content |
| `bun run db:boundaries` / `db:roads` | Municipal outlines / OSM road network |
| `bun run gen:native` | Regenerate OpenAPI, Kotlin client, native strings and tokens |

## Repository layout

```text
apps/
  web/            Next.js: public site, admin panel and the API
    src/          app routes, oRPC procedures, domain modules, db schema
    drizzle/      SQL migrations (forward-only)
    tests/        bun test suites
  ios/            SwiftUI app (XcodeGen project)
  android/        Jetpack Compose app
packages/
  contracts/      API contract and the generated OpenAPI document
  shared/         copy catalogue (es.json), brand and design tokens
  kmp/            Kotlin Multiplatform core shared by both native apps
native/           Gradle root for android + kmp: wrapper, version catalog, build-logic
scripts/
  db/             seed and import scripts; sources/ holds the pinned GeoJSON
  ops/            worker, staff grants, release, runtime preparation
  checks/         docs and quality gates, feature verifiers
  brand/          icon generator and full-resolution illustrations
infra/            Dockerfile, Compose, Caddy, Postgres image
  backup/         backup, off-site copy, restore and restore rehearsal
docs/             architecture, deployment, operations, native, quality
```

## Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS with Docker Compose, and the contest demo
- [OPERATIONS.md](docs/OPERATIONS.md) — runbook
- [NATIVE.md](docs/NATIVE.md) — the native iOS and Android apps

## License and data

MIT — see [LICENSE](LICENSE).

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, under the ODbL.
- Municipal boundaries: Oficina Nacional de Estadística, via
  [OCHA COD-AB](https://data.humdata.org/dataset/cod-ab-dom) (CC BY-IGO),
  pinned in `scripts/db/sources/boundaries/`.
