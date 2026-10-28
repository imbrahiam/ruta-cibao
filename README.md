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
bun run dev                                       # API + admin on :3000
bun run mobile:ios                                # or mobile:android
```

- Admin panel: <http://localhost:3000/admin>
- API reference: <http://localhost:3000/api/docs>

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` / `build` / `start` | Web server |
| `bun run worker` | Background jobs |
| `bun run mobile` | Expo dev server |
| `bun run typecheck` / `lint` | TypeScript (web + mobile) / Biome |
| `bun test` | Tests |
| `bun run db:generate` / `db:migrate` | Write / apply migrations |

## Docs

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS with Docker Compose, and the contest demo
- [OPERATIONS.md](docs/OPERATIONS.md) — runbook

## License and data

MIT — see [LICENSE](LICENSE).

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, under the ODbL.
- Municipal boundaries: Oficina Nacional de Estadística, via
  [OCHA COD-AB](https://data.humdata.org/dataset/cod-ab-dom) (CC BY-IGO),
  pinned in `data/boundaries/`.
