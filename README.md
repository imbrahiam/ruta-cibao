# Ruta Cibao

Civic map for the province of Santiago Rodríguez, Dominican Republic — Sabaneta,
Monción and Villa Los Almácigos. Residents and visitors share places,
businesses, routes, traffic reports and public consultations on one map; the
municipality moderates them from a web admin panel and gets a weekly PDF report.

Built for the FUNDESER **TechEmprende SR Conecta 2026** contest. MIT licensed.

## What's in the repo

| Path | What it is |
| --- | --- |
| `apps/mobile` | The citizen app — Expo / React Native (iOS and Android) |
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
docker compose -f infra/docker-compose.yml up -d  # Postgres + storage
bun install
bun run db:migrate
bun run db:seed && bun run db:seed:demo           # optional demo content
bun run dev                                       # landing + API + admin on :3000
bun run mobile:ios                                # or mobile:android
```

- Landing: <http://localhost:3000/>
- Admin panel (authorized staff only): <http://localhost:3000/admin>
- API reference: <http://localhost:3000/api/docs>

### Web-only preview

With dependencies installed and `.env` configured, run `bun run dev` from the
repository root. This starts only Next.js, not Expo, the background worker or
Docker services. The public landing can be inspected without starting the mobile
app; database-backed requests still need Postgres.

### Which surface does what?

| Surface | Purpose |
| --- | --- |
| `/` | Public landing introducing the mobile app; not an interactive web map or an admin dashboard |
| `/admin` | Municipal staff workspace; anonymous visitors see sign-in, and signing in does not grant a staff role |
| `/s/[kind]/[ref]` | Public shared detail pages for places, routes, consultations and traffic notices |
| `/privacidad`, `/terminos`, `/soporte`, `/cuenta/eliminar` | Public privacy, terms, support and account-deletion pages |
| `apps/mobile` | Citizen experience, including the interactive map and community participation |

The landing describes six product capabilities: places and services on a map,
local businesses, routes, traffic notices, consultations with municipal follow-up,
and weekly municipal PDF reports. These cards describe the product; they are not
six tools embedded in the landing.

The municipal workspace organizes moderation of places, business claims, photos,
corrections, routes, traffic and content reports, plus consultation follow-up,
weekly reports and administrator-only categories. These sections support the same
citizen-facing features rather than a second public map.

Local browser review on 2026-10-29: the landing displays iPhone and Android as
coming soon and a notice in place of app screenshots. Download links and
screenshots are conditional on configuration and supplied assets. Desktop and
390-pixel mobile layouts were inspected; the mobile page had no horizontal
overflow. Anonymous `/admin` displayed the municipal sign-in form; authenticated
staff workflows were not exercised in this review.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` / `build` / `start` | Web server |
| `bun run worker` | Background jobs |
| `bun run mobile` | Expo dev server |
| `bun run typecheck` / `lint` | TypeScript (web + mobile) / Biome |
| `bun test` | Tests |
| `bun run test:db` | Tests that need Postgres and storage |
| `bun run check:docs` | Fails when a document names something that does not exist |
| `bun run db:generate` / `db:migrate` | Write / apply migrations |

## Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS with Docker Compose, and the contest demo
- [OPERATIONS.md](docs/OPERATIONS.md) — runbook
- [MOBILE.md](docs/MOBILE.md) — building and publishing the phone app

## License and data

MIT — see [LICENSE](LICENSE).

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, under the ODbL.
- Municipal boundaries: Oficina Nacional de Estadística, via
  [OCHA COD-AB](https://data.humdata.org/dataset/cod-ab-dom) (CC BY-IGO),
  pinned in `data/boundaries/`.
