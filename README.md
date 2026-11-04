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
docker compose -f infra/docker-compose.yml up -d  # Postgres + storage
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

### Public visual design


The public site follows a photo-free product-studio direction inspired by
[Moonjar](https://moonjar.ai/). Browser inspection measured its warm `#fafaf7`
canvas, `#2a2a27` ink, Inter typography (52px desktop hero, 56px section headings),
rounded black calls to action, white panels and soft layered shadows. The
implementation adapts that visual grammar rather than copying its assets.

The header stays in normal document flow. The header, footer and public pages
share a light theme; the admin theme remains separate. Encuentro, an open C and
meeting point on a flat iris tile (`#7860a8`), is the active web and native identity.
Original map/product illustrations are conceptual, not geographic data or actual
app screenshots. The landing does not use the Monción or Sabaneta
photographs. Real screenshots appear only when supplied. Store links remain
configuration-driven, with coming-soon states for unavailable downloads.
The shared footer pairs the Dominican flag with the province, separates discovery
and help links from legal utilities. Link hover reveals only a lavender brush,
drawn left to right with clipping rather than scaling its thickness. Keyboard focus
retains a visible outline, and motion respects reduced-motion settings.
`/support` guides residents through the in-app support path, with a decorative
account/help illustration and accessible, Motion-animated FAQs for access, place data,
offline use and account deletion. Compass and waving-hand emoji accents prefer
Apple Color Emoji, falling back to the platform's color emoji font.
The standalone compass is the hero's main visual cue; the hand scales with the FAQ heading.
Its links lead to real public routes; no contact form, live response promise or
unpublished support address is invented.

### Social-app identity

Encuentro is selected. `packages/shared/src/brand.ts` supplies its geometry and
colors to the web logo, the native brand component and the web asset generator.
Run `bun run scripts/brand/generate-brand-assets.ts` after changing that source to
regenerate the browser SVG, the Apple touch icon and the native app icon.

`/design/brand` marks Encuentro as active and preserves the three alternatives
for comparison: Vínculo (linked strokes, forest `#28594a`), Rumbo (cut R, blue
`#3468d8`) and Plaza (three radial forms around a point, wine `#783b57`).
Each option includes app-icon and wordmark contexts, small-size displays and
downloads; a shared monochrome row separates silhouette from color.
Reference imagery was inspected
in the official [Instagram](https://www.meta.com/brand/resources/instagram/instagram-brand/),
[X](https://x.com/), [Threads](https://www.meta.com/brand/resources/threads/) and
[Bluesky](https://bsky.social/about/support/icons) pages; no third-party marks
are included in the proposal assets.

Downloadable SVGs and 1024px PNGs live in
`apps/web/public/brand/proposal/`. The app-icon PNG is square with no baked-in
corner mask; its rounded appearance is applied only in the preview. The review
page is no-index and intentionally absent from the public sitemap.
Browser verification covered all four 16/24/32/64px symbol displays, the shared
monochrome comparison, a 390px layout without overflow, and all 21 downloadable
SVG/PNG assets returning HTTP 200 with expected types. After reload the browser
reported no errors. These are design proposals, not trademark clearance.

All visible copy comes from the Spanish catalogue; URLs remain English. A small
Motion client component continuously loops only the last word of the headline
(cercana / nuestra / humana); “Tu provincia, más” stays fixed. The words use dark
ink and a lavender underline. A measured, animated width follows each word rather
than reserving the widest word's space. The cycle changes every 2 seconds:
entry takes 440ms, exit 240ms and width adjustment 560ms, with 0.2em vertical
travel and 0.08em blur. These timings were measured from a browser recording of
Moonjar; the implementation uses Motion with an ease-out curve.
The underline is a complete SVG brush path, revealed left to right by an animated
clip after a 120ms delay. It does not use normalized path length or stroke dashes,
which could truncate the stroke with a non-scaling path. The 4px stroke remains
independent of text blur and width changes.
A stable screen-reader label and reduced-motion preference keep a static version
available. Changes stop while the document is hidden; page copy and visual
contents remain server-rendered inside small client motion boundaries.
The `/experience`, `/territory` and `/download` hero headings reuse the same
rotating-word and brush behavior. Their fixed two-line compositions keep the
route's meaning stable, with yellow and lavender accents rather than text-color changes.
Mobbin MCP was previously queried but required a paid plan and returned no
references. No third-party screens, testimonials, usage figures or videos are
fabricated.

The landing no longer renders a location pin: “aquí.” uses its normal accented
letter and yellow highlight. The acute-accent pin experiments remain preserved
only at `/design/pins` for later review.

Download controls use the App Store and Google Play glyphs from
[Simple Icons](https://github.com/simple-icons/simple-icons/tree/develop/icons)
(CC0 geometry; trademarks belong to their respective owners), not device logos.
Both stores have the same active appearance. Configured store URLs render real
links; otherwise enabled buttons announce “Próximamente” on activation without
inventing a destination. The phone's own store remains first.
Desktop and 390px mobile browser checks verified both enabled store controls,
their upcoming-release feedback, all three rotating phrases and the lavender
brush. Reduced motion settled on a static phrase without horizontal overflow.

On desktop with a fine hover pointer, concept scenes fade in once over 650ms.
Their scroll depth is spring-smoothed and bounded to ±18px. Selected devices and
notes float through a 7px, 5.6-second idle cycle. Hover adds a 14px phone lift,
5px map-window lift and 6–10px paper lifts, preserving original rotation/scale.
Idle animation and scroll subscriptions stop outside the viewport or in hidden
documents. All depth/idle/hover effects are disabled on touch/mobile layouts and
under reduced motion; content is visible before hydration.

Browser verification observed changing idle offsets, bounded depth changes after
scroll, and cleanup of the idle variable outside the viewport. Reduced motion
returned the scene transform and phone translation to none. The location badge
fit the 390px layout without overflow, and the browser reported no errors.

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
background on hover. Browser observation confirmed that all three words reach
an unclipped, solid lavender stroke with 4px width and no blur. Layout widths
of 320/390/768/1024px
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
were observed. Those earlier public-site checks did not exercise authenticated admin workflows.

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
| `bun run typecheck` / `lint` | TypeScript / Biome |
| `bun test` | Tests |
| `bun run test:db` | Tests that need Postgres and storage |
| `bun run check:docs` | Fails when a document names something that does not exist |
| `bun run db:generate` / `db:migrate` | Write / apply migrations |

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
