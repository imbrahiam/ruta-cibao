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
| `/experience`, `/territory`, `/download` | Dedicated product, province and app-distribution pages in the same public design system |
| `/admin` | Municipal staff workspace; anonymous visitors see sign-in, and signing in does not grant a staff role |
| `/s/[kind]/[ref]` | Public shared detail pages for places, routes, consultations and traffic notices |
| `/privacy`, `/terms`, `/support`, `/account/delete` | Public privacy, terms, support and account-deletion pages |
| `apps/mobile` | Citizen experience, including the interactive map and community participation |

Public URLs and section anchors use English. Main calls to action navigate to
`/experience`, `/territory` and `/download`; homepage section anchors remain
available for direct reading. Visible interface copy remains Spanish.

The landing describes six product capabilities: places and services on a map,
local businesses, routes, traffic notices, consultations with municipal follow-up,
and weekly municipal PDF reports. These sections describe the product; they are
not six tools embedded in the landing.

The municipal workspace organizes moderation of places, business claims, photos,
corrections, routes, traffic and content reports, plus consultation follow-up,
weekly reports and administrator-only categories. These sections support the same
citizen-facing features rather than a second public map.

The public site follows a photo-free product-studio direction inspired by
[Moonjar](https://moonjar.ai/). Browser inspection measured its warm `#fafaf7`
canvas, `#2a2a27` ink, Inter typography (52px desktop hero, 56px section headings),
rounded black calls to action, white panels and soft layered shadows. The
implementation adapts that visual grammar rather than copying its assets.

The header stays in normal document flow. The header, footer and public pages
share a light theme; the admin theme remains separate. The refreshed web mark is
an original lavender folded field guide, not a replacement for the native app icon.
Original map/product illustrations are explicitly labelled as visual concepts,
not actual app screenshots. The landing does not use the Monción or Sabaneta
photographs. Real screenshots appear only when supplied. Store links remain
configuration-driven, with coming-soon states for unavailable downloads.

All visible copy comes from the Spanish catalogue; URLs remain English. A small
Motion client component continuously loops only the last word of the headline
(cercana / nuestra / humana); “Tu provincia, más” stays fixed. The words use dark
ink and a lavender underline. A measured, animated width follows each word rather
than reserving the widest word's space. The cycle changes every 2 seconds:
entry takes 440ms, exit 240ms and width adjustment 560ms, with 0.2em vertical
travel and 0.08em blur. These timings were measured from a browser recording of
Moonjar; the implementation uses Motion with an ease-out curve.
The underline is a separate SVG brush path, revealed left to right after a
120ms delay. A non-scaling 4px stroke remains independent of text blur and width
changes, avoiding apparent thickness changes during transitions.
A stable screen-reader label and reduced-motion preference keep a static version
available. Changes stop while the document is hidden; the rest stays server-rendered.
Mobbin MCP was previously queried but required a paid plan and returned no
references. No third-party screens, testimonials, usage figures or videos are
fabricated.

The header places the brand at left, links to experience/territory/support in
the center and download/municipal actions at right. Text navigation changes
only color on hover; action pills keep distinct backgrounds and focus outlines.
Primary and secondary public actions share 44px height and 14px type tokens.
The hero no longer has a province eyebrow or dot. Its animated word and fixed
prefix have matching vertical text positions, including at mobile widths.
The same header is used on the three product pages; duplicated top tabs and back
links have been removed. Product-page heroes have no dotted eyebrow labels.
The territory heading has an explicit two-line break after “Tres municipios.”,
verified at 1440px, 390px and 320px. The brush uses explicit lavender `#b8a6cf`
and reaches its complete stroke before the next word transition.

The public layout exports a single `#fafaf7` theme color and light color scheme.
Root canvas rules follow the public layout's active `color-scheme: light`
metadata and set both `html` and `body` to that color, even under dark system
preferences. This also avoids matching inactive pages retained by Next.js.
Admin pages retain their existing system-dependent canvas and theme metadata.
The hero glow uses shared public lavender gradient tokens.
The commerce pin retains its -18-degree outer tilt; its icon is counter-rotated
to remain upright. The territory section uses three original paper-map collages.

Browser checks confirmed matching `#fafaf7` document/body/theme metadata after
reload, unchanged dark admin canvas, and a zero-pixel vertical difference between
the resting word and its fixed prefix on desktop and mobile. Header and hero
actions measured 44px with 14px text. Central navigation retained a transparent
background on hover. The recorded brush cycle changed its stroke dash length
while maintaining 4px width and no blur. Layout widths of 320/390/768/1024px
had no horizontal overflow. Native Safari toolbar rendering and rubber-band
pull-to-refresh were not directly exercised; their document colors and metadata
were verified in Chromium.

Refinement verification covered the three new routes at 1440px and 390px, their
canonical URLs and cross-page links, plus 320px page navigation. The homepage
remained within 320px, 390px, 768px and 1024px widths. Browser observation confirmed
the complete continuous headline cycle, no pause control, live reduced-motion
changes and a stable reduced state. A simulated hidden-document visibility event
stopped phrase changes. A later desktop recording confirmed the animated width
varied from 173.55px to 187.70px across the three words. The 390px mobile loop did
not overflow, and reduced motion left one sharp static word with no animations.
Selection and municipal hover were visually inspected; no browser errors were
observed. Typecheck, lint, docs, build and the default tests passed (103 passed,
111 skipped, 0 failed).

Browser verification of the photo-free revision covered 1440px desktop and
390px mobile, including a dark system preference and reduced motion. Both
layouts stayed within the viewport. The hero measured 52px Inter with 53.04px
line height on desktop. The page contained no photographic image elements,
all four scenes had visible concept captions, and reduced motion produced no
running animations. Experience/download links reached their sections, and the
header scrolled out of view instead of sticking. Privacy, terms, support,
account deletion and admin entry routes returned HTTP 200. No browser errors
were observed; authenticated admin workflows were not exercised.

Additional width checks at 320px, 768px and 1024px found no horizontal overflow.
Typecheck, lint, documentation validation and production build passed. The
default test suite reported 103 passed, 111 skipped and 0 failed. The build
retains two warnings about Node stdout/stderr in the Edge logger; this visual
revision does not change that subsystem.

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
