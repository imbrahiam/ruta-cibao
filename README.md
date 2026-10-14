# Ruta Cibao

Civic map for the province of Santiago Rodríguez, Dominican Republic — Sabaneta,
Monción and Villa Los Almácigos. Residents and visitors put places, businesses,
ecotourism routes, traffic reports and public consultations on one map; the
municipality moderates them from an admin panel and gets an automatic weekly PDF
report.

Built for the FUNDESER **TechEmprende SR Conecta 2026** contest. MIT licensed.

> Status: scaffold. The API, database and container build are wired up; the six
> product features are not built yet. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Bun for development and builds, Node 24 in the production image |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict |
| Database | PostgreSQL 18 + PostGIS + pgvector, via Drizzle ORM |
| API | oRPC v2 — typed RPC for this app, OpenAPI + Scalar for everyone else |
| Auth | Better Auth, with a JCE cédula verification step in onboarding |
| Tooling | Biome, `bun test`, droast for the Dockerfile |

## Running it locally

You need [Bun](https://bun.sh) and Docker.

```bash
cp .env.example .env          # then fill in the values
openssl rand -base64 32       # -> BETTER_AUTH_SECRET

docker compose -f infra/docker-compose.yml up -d   # Postgres + MinIO
                                                   # (first run builds Postgres)
bun install
bun run db:migrate            # creates the extensions, applies migrations
bun run dev
```

- App: <http://localhost:3000>
- API reference: <http://localhost:3000/api/docs>
- OpenAPI document: <http://localhost:3000/api/spec.json>

Set `JCE_USE_MOCK=1` to develop without touching the real cédula registry. The
registry allows 50 uncached lookups per hour across every client, so leave the
mock on unless you are specifically testing that path.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Development server |
| `bun run build` | Production build (standalone output) |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | Biome: format, lint, import order |
| `bun test` | Unit tests |
| `bun run db:generate` | Write a migration from the schema |
| `bun run db:migrate` | Apply pending migrations |
| `bun run auth:generate` | Regenerate the Better Auth tables |

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — VPS with Docker Compose, and Railway
- [OPERATIONS.md](docs/OPERATIONS.md) — runbook

## License

MIT — see [LICENSE](LICENSE).

### Map data

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, under the ODbL. The map shows this credit behind its (i)
  button, which is what the licence requires.
- Basemap tiles and style from [Protomaps](https://protomaps.com) (style CC0,
  code BSD-3).
- Municipal boundaries © [geoBoundaries](https://www.geoboundaries.org)
  (gbOpen, CC BY 4.0).
