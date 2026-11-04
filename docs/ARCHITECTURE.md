# Architecture

What exists today, and where the rest is going. Sections marked **Planned**
describe decisions that are settled but not yet built.

## Request paths

Three handlers live under `/api`, and Next resolves literal segments before the
catch-all, so they do not collide:

| Path | Handler | Audience |
| --- | --- | --- |
| `/api/auth/*` | Better Auth | Sign-in flows |
| `/api/rpc/*` | oRPC `RPCHandler` | This app's typed client only |
| `/api/*` | oRPC `OpenAPIHandler` | Third parties, plus `/api/docs` and `/api/spec.json` |

One router (`apps/web/src/orpc/router.ts`) feeds both oRPC handlers, so the REST surface
and the OpenAPI document can never drift from the RPC one. Publishing a usable
API is a contest deliverable, which is why the spec is generated rather than
written.

`/api/rpc` accepts no GET. oRPC v2 refuses it by default, and rightly: a
procedure reachable by GET is reachable from a cross-site `<img>` or `<script>`
tag, which would mean taking on CSRF protection for no benefit.

The oRPC packages are pinned to `2.0.0-beta.32`. v2 is where the library is
going and its OpenAPI story is the one this project needs; the cost is a beta
whose API can shift between releases, so every `@orpc/*` version is pinned
exactly rather than tracking the `beta` tag.

Large binary responses — vector tiles, PDF and GPX downloads — will use plain
route handlers instead of oRPC, since they are not JSON-shaped.

## Layers

```
apps/web/src/app/        routes and UI
apps/web/src/orpc/       procedures, request context, permission middleware
apps/web/src/modules/    domain services — typed commands, Zod contracts
apps/web/src/db/         Drizzle schema, connection pool, migrations
apps/web/src/lib/        adapters and cross-cutting helpers
```

Business rules belong in `apps/web/src/modules`, not in route handlers.
Validation is concentrated at the edges — oRPC inputs, env parsing, provider
responses — so everything inside works with types that are already known to be
good.

## Configuration

`apps/web/src/lib/env.ts` parses `process.env` with Zod and caches the result.
Validation is lazy so `next build` needs no configuration and no secret is ever
baked into an image layer; `apps/web/src/instrumentation.ts` forces the check
when the server boots, so a misconfigured deployment fails to start instead of
failing a request.

Anything environment-specific goes through an adapter, which is what lets the
same image run on a VPS or on Railway: storage (SeaweedFS / S3 / R2),
geocoding, routing, mail and push.

## Observability

`apps/web/src/lib/log.ts` writes one JSON object per line to stdout or stderr.
`apps/web/src/proxy.ts` assigns every request an id before any handler runs,
forwards it as `x-request-id`, and echoes it on the response; the oRPC and
OpenAPI handlers log status, duration and failures against the same id. The id
is generated server-side rather than accepted from the caller, because a header
the client controls is a log-injection vector.

The logger redacts fields whose names look personal and truncates long values.
It keeps stacks, because a log without a stack is a report nobody can act on.

The native app has no console a maintainer can read. It reports a survived
crash to `/api/client-errors`, which validates a small bounded body, rate-limits
it per client, and writes one `client.error` line. Nothing is stored, and the
report carries no identity, coordinates or screen content.

## In-app directions

The public `directions.compute` procedure (`POST /api/directions`) accepts
`{ origin: { lat, lng }, destination: { lat, lng }, mode: "drive" | "walk" }`
within the Dominican Republic bounding box. It returns distance in metres,
duration in seconds, a decoded path, and Spanish maneuver instructions.
The native full-screen `directions` screen accepts `{ lat, lng, name }`, requests
foreground location, and previews that route with driving/walking selection.
An optional Maps link hands off to an installed navigation app; the preview
does not provide voice navigation or background location tracking.

The server calls Google Routes with the optional, server-only
`GOOGLE_MAPS_SERVER_API_KEY` (Routes API and billing must be enabled). Requests
time out after eight seconds and are limited to 30 per client per minute through
the existing database limiter. No key means typed `unavailable` (503), no route
means `no_route` (404); invalid provider responses also become `unavailable`.
Coordinates and provider bodies are not logged, cached, or audited.
Run `bun run scripts/checks/verify-directions.ts` against the running local API on port
3000 to report the real Sabaneta–Monción route distance and duration without
printing credentials.

## Place thumbnails

Published app photos (including seeded imagery) always win. Place browse,
detail, nearby, search and saved outputs expose optional `thumbnailUrl` and
`thumbnailSource: "app" | "google" | null`; the public GeoJSON also exposes `thumb`.
For a cached Google match without app imagery the URL is
`/api/places/{id}/thumbnail`. Native list thumbnails fall back to category
badges on missing images or errors.

The staff desk lays each reported traffic stretch on Google's road with the
Roads API `snapToRoads` (`interpolate=true`, 100 points per call) through
`moderation.snapRoad`: moderator-only, 600 per client per minute, answers kept
in process (a road does not move). Trails (`mode: "trail"`) are routed on foot
through the traced points with the Routes API (`WALK`, `HIGH_QUALITY`,
`GEO_JSON_LINESTRING`: the encoded polyline is rounded to about a metre). Both
answers go through `cleanCentreline` (`modules/maps/centreline.ts`): vertices
under 3 m apart merge, out-and-back spurs collapse, corners are rounded within
4 m. The result is dropped, and the stretch keeps its own smoothed geometry,
when a snapped vertex is more than 25 m from the reported line or the length
differs by more than -15%/+30% (trails: -30%/+150%). The desk draws it as one
line exactly as wide as the street's fill: `mapStyle` paints every road class
with the same fill `weight` for the zoom (`ROAD_FILL_PX` in
`components/admin/map/road-stretch.ts`, restyled when the zoom crosses a level)
and `stretch-overlay.ts` strokes that same width, because Google's own fill
widths vary by road type in ways no API reports. Enable the Roads and Routes
APIs for `GOOGLE_MAPS_SERVER_API_KEY` or the desk falls back to the reported
geometry.

Enable Places API (New) and billing for `GOOGLE_MAPS_SERVER_API_KEY`, alongside
Routes API. Run `bun run db:migrate`, then
`bun run scripts/db/match-google-places.ts` to match published places without app
photos sequentially, with 200 ms spacing. Only matches within 250 metres are
accepted; IDs and negative checks expire for rechecking after 30 days. Every
completed check atomically records a system `places.google_match_checked` audit
event without an actor or provider response.

`GET /api/places/{id}/thumbnail` checks publication and absence of app imagery,
limits clients to 60 requests/minute, and redirects (302) to a fresh Google photo
URI with `Cache-Control: public, max-age=86400`. `X-Photo-Attribution` carries the
first author's display name (URI-encoded if outside the HTTP Latin-1 range).
Google responses are Zod-validated with six-second timeouts per request.
No Google photo bytes, photo names or media URIs are persisted server-side.
No match/photo returns 404; provider failures return uncached 502.

## Database

PostgreSQL 18 with PostGIS and pgvector. `apps/web/src/db/migrate.ts` creates both
extensions before applying migrations and is safe to re-run, so a retried deploy
converges instead of half-applying.

No published image carries both extensions, so `infra/postgres/Dockerfile`
builds one: `imresamu/postgis` (the multi-arch build of the official PostGIS
image) plus the pgvector package. Multi-arch matters — the official
`postgis/postgis` is amd64 only, which means an emulated, slow database on an
Apple Silicon laptop.

pgvector is no longer used by any table — the place embeddings went with the
assistant. The migrator still creates the extension, so databases set up before
the migrations were squashed keep matching; it can leave the image later.

Geometry columns are real
geometries, not latitude/longitude pairs — map layers are served as Mapbox
Vector Tiles generated by `ST_AsMVT` in the database rather than as thousands of
DOM markers.

Schema files are split by bounded context under `apps/web/src/db/schema/` and
re-exported through the barrel, which is what both Drizzle and the Better Auth
adapter read. `apps/web/src/db/schema/auth.ts` is generated by
`bun run auth:generate` — edit `apps/web/src/lib/auth.ts` and regenerate rather
than editing it by hand.

## Identity

Two tiers. The contest asks the platform to serve tourists as well as residents,
and neither is asked for an identity document.

| Tier | How they get there | What they can do |
| --- | --- | --- |
| Visitor | No account | Browse the map, places, routes and consultations |
| Member | A verified phone number or email address | Also review, upload photos, report traffic, open consultations, register a business |

Participation is progressive trust: proving control of a phone number or an
email address is enough to contribute. There is no cédula lookup, no document
upload and no separate citizen rank. A municipal resident badge is optional and
granted in person by staff; it weights a resident's vote and photo review but
grants no moderation authority.

Staff authority is a separate, explicit grant. `requireMember()` and
`requireModerator()` enforce the split, and the oRPC builder each procedure
hangs off is where the check lives — so a new procedure cannot quietly skip it.
Better Auth's `admin` flag and the profile's staff role are written together by
`scripts/ops/grant-staff.ts`; no screen can grant authority.

## Realtime

`realtime_events` is the source of truth and `LISTEN/NOTIFY` is only a nudge.

Plain `NOTIFY` is fire-and-forget: a client disconnected at that moment loses
the event permanently, with no way to ask what it missed. This province has
intermittent connectivity — it is why the app has an offline queue at all — so
realtime built on the assumption that nobody disconnects would fail exactly
where it matters. `NOTIFY` also caps its payload at 8000 bytes, so it was
always going to carry an id rather than data.

A trigger on insert notifies; each open stream then drains the table from its
own cursor. A dropped notification therefore costs latency, not an event.

`/api/realtime` is Server-Sent Events, not WebSockets: traffic only flows
server to browser, `EventSource` reconnects on its own, and it passes through
Caddy with no upgrade handling to get wrong. Every message carries `id:`, so a
browser that loses signal sends `Last-Event-ID` when it returns — the spec
makes it do that, there is no client code for it — and the gap is replayed.

Two details worth knowing:

- Row ids are assigned before commit, so a long transaction can commit an id
  below one a reader already passed. A periodic sweep re-reads the last thirty
  seconds and readers de-duplicate by id, which closes that window for any
  transaction shorter than it.
- A viewer's own `user:<id>` channel is derived from the session, never from
  the query string. Public channels are an allowlist: `traffic`, `places`,
  `routes`, `consultations`.

Events expire after an hour. The log is there so a reconnecting browser can
catch up, not to be a history — `audit_events` answers questions about the past.

## Data fetching

Cache Components and Partial Prefetching are enabled (`next.config.ts`).
`"use cache"` gives a function's result a lifetime so it can be part of the
static shell, and `<Suspense>` covers what genuinely varies per person. A
`<Link>` prefetches that shell, so a click renders immediately and only the
per-user parts stream in.

This is why there are no skeleton screens. A skeleton says the page has nothing
real to show yet; here it does. Where waiting is genuinely possible, feedback
goes inline in the control that was touched — `useLinkStatus` for navigation,
`useFormStatus` for submits — so nothing on the page moves.

Forms are Server Actions, which work while JavaScript is still loading. They
call the same module services the oRPC procedures do, so the two cannot drift.

For client-side reads, `@/lib/orpc` exposes the typed router as TanStack Query
options. `staleTime` is generous on purpose: the live stream pushes changes as
they happen, so refetching on a timer would spend a rural phone's data plan
learning what an event already said. `useRealtime` invalidates the queries a
channel feeds, or hands the payload over for a direct cache patch where that
avoids a round trip.

## Background jobs

pg-boss, in its own container (`scripts/ops/worker.ts`, the `worker` compose
service), keeping its queues in the same PostgreSQL everything else uses. One
database to back up and to explain in the handover runbook, and a job queued
inside a transaction cannot survive that transaction rolling back.

Two processes hold an instance and they want different things. The web app
sends and nothing else — no supervisor, no cron, no migrations. The worker owns
the schema, runs the cron, and does the work, which is what stops a rolling
deploy racing two migrations and three app instances racing the same schedule.

`dispatch()` is the only way work is handed over, and it has two behaviours
behind one signature: with a queue, the job is sent and the request returns;
without one, the same handler runs in-process, detached, with its failure
logged. So `JOBS_ENABLED=0` — `bun run dev`, a single-container demo — means
"this happens on the request instead", never "this never happens". Every
handler is idempotent, because pg-boss retries and a restart mid-job is
ordinary.

| Queue | When | What |
| --- | --- | --- |
| `traffic.notify-nearby` | on report | Tells people near a fresh report |
| `traffic.expire` | every 10 min | Lapses reports nobody vouched for |
| `reports.weekly` | Mon 06:00 | Builds last week for every municipality |
| `reports.render` | on request | Draws one report to PDF |
| `notification.deliver` | on event | Push and email fan-out |
| `notification.native-push-receipts` | every 5 min | No-op: APNs reports each delivery in its response |
| `account.deletion` | on request | Removes an account and what it contributed |
| `offline.snapshot` | daily 04:30 | Rebuilds the versioned offline artifact |
| `platform.cleanup` | hourly | Drops expired events, keys and buckets |

Cron times are `America/Santo_Domingo`, which does not observe daylight saving —
so a schedule means the same wall-clock time all year, and the weekly report can
be promised for Monday morning rather than "give or take an hour, twice a year".

## Traffic

A traffic report is a point or a stretch of road, and the difference is not
cosmetic: a hole is *somewhere*, a flood is somewhere *along*, and standing a
point in for a stretch tells a driver the wrong thing twice — it hides how much
road is affected and puts the whole problem at one end of it.

Nothing is drawn or measured out by hand. The crosshair asks one question — 
which road is this — and the map shades the answer, the way a chosen route is
drawn in blue except that it is one street rather than a journey. Covering the
street is the default when reporting traffic; a point is the fallback, for a
problem that genuinely is at one spot and for a crosshair sitting off the road
network entirely.

Nothing Google sells answers "what shape is the street under this point". Roads
snaps points *to* the network without returning the way they landed on,
Directions routes *between* two points, and Places returns businesses.
OpenStreetMap is the only source with the way itself, so the geometry is OSM's.

It is read from this project's own PostGIS, not from Overpass per request. The
per-request version worked in testing and then stopped dead: the public
instances rate-limit by IP and eventually refuse the connection outright, and
every lookup after that reached a citizen as "aquí no encontramos una calle" —
the map blaming the road for a quota. `bun run db:roads` imports the province
once into `roads` (~4,300 ways), rotating across Overpass mirrors; a lookup is
then one indexed nearest-neighbour query answering in single-digit milliseconds
with no network at all.

Because the network is local, the picker can afford to show its work: every road
in view is drawn as a translucent band, which is both the highlight and the tap
target — Google decides what a polyline click catches from its `strokeWeight`,
so there is no invisible second shape to keep in step. Tapping a band picks that
road; on a desktop, hovering previews one; the crosshair still works and is the
fallback above street zoom, where the box holds more ways than can be drawn as
choices.

The answer is trimmed to a window around the point. OSM draws a road as one way
until something about it changes, and shading eleven kilometres of highway would
say the whole road is flooded when what is flooded is the bit by the bridge.

The app never sends the road's shape. It sends where the crosshair was and
whether the report covers the street, and the server looks the street up again
from that coordinate — a client that could post arbitrary geometry could lay a
closed road across somebody's front garden.

`location` stays on every report — the midpoint of the road for a stretch — so
the marker, the municipality lookup and the "cerca de ti" fan-out all have one
coordinate to work from instead of deriving one per query from a line.

Reported roads are drawn on the scale everybody already reads: red for blocked,
amber for passable-with-care, yellow for worth-knowing, green for a road
neighbours have since said is clear. That last colour is the one a speed-based
layer cannot have, and the most useful thing here — a road flooded this morning
and open now is exactly what somebody deciding whether to set off is asking, and
only the people who drove past can answer it. Cleared roads stay for three hours
and carry no marker: information, not something to act on.

Which problems block a road is `categories.severity`, not a list of ids in the
code — an official adding "Derrumbe" has to be able to say it blocks without a
deploy. The layer is on by default, unlike every other one, because what
citizens report about the roads is what this platform knows that no other map
does; Google's speed layer sits beside it and covers the highways, where this
one covers the rural roads Google has no probe data for at all.

## Reports

A weekly report is a statement about a week that has ended, so the figures are
computed once and stored in `weekly_reports.metrics` rather than queried on
read. Opening one in November has to give the numbers it gave in March, even
though the rows behind it have since been moderated, edited or deleted; a live
query would quietly rewrite history every time somebody looked.

The PDF is drawn by `pdf-lib` in the worker from the figures stored on the
report row. There is no browser in the runtime image, and no second layout that
could disagree with the stored numbers: the report is the numbers, and the PDF
is a convenience that can be regenerated at any time.

## The phone map

The public map lives in the native app. It is `react-native-maps`,
with Google Maps on both platforms by default and Apple Maps as an iOS-only
alternative (`EXPO_PUBLIC_MAP_PROVIDER=apple`). The app draws places, routes and
traffic from first-party GeoJSON and vector tiles served by this API, so the
basemap provider is replaceable without touching the data layer.

`/api/tiles/*` renders Mapbox Vector Tiles with `ST_AsMVT` in Postgres. The
offline snapshot job publishes a versioned artifact the app downloads on
request, so a phone with no signal still has the last published content.

The staff desk draws maps too, for reviewing a place, a traffic report or a
route (`apps/web/src/components/admin/map`). It uses the Google Maps JavaScript
API with the phone app's marker semantics, severity colour plus category glyph,
and solid routes with a start disc and an end square. It loads only when a map
is on screen (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`). If the key is
missing or rejected, or the script is blocked, each map becomes its coordinates
with copy and open-in-maps actions. The traffic, places and routes desks also
offer a `?view=map` mode that works the whole queue on one map.

The map menu separates the basemap type, Map or Satellite, from the road-map
style, Colores or Gris. Colores is the default. It uses green vegetation, blue
water, warm pastel land and pale roads. Gris retains the existing monochrome
palette. Both styles follow the system light or dark appearance.
`use-map-choice.ts` shares one validated choice across thumbnails, enlarged maps
and queue map views. It persists in `localStorage` and falls back to memory when
storage is blocked. A style switch restyles the existing map without resetting
its camera.

Both styles use the same road-fill weight from `road-stretch.ts`. Changing the
palette must not change that weight independently of the reported-stretch
overlay. `stretch-color.ts` adjusts overlay contrast against the selected
palette without adding an outline outside the road.


## The staff desk's data flow

The desk (`apps/web/src/components/admin`) is client-rendered behind the session
gate and keeps its data in TanStack Query. Three rules keep it feeling instant:

- **Decisions are optimistic.** `queue/use-decision.ts` removes the decided
  card from every cached copy of its list (or patches it, for a consultation
  that stays open or a traffic report whose text was reviewed) and moves the
  sidebar count before the request leaves. A refusal puts back exactly that
  card, in its place, with the reason inline; a conflict or a vanished item is
  not put back and the lists refetch. The refetch is never awaited, and only
  the last decision in flight triggers it. `useStaffMutation` keeps one request
  id per payload (per card for decisions), and fails at once when offline.
- **Nothing blanks.** Lists keep their previous rows while a filter changes,
  failed background refetches leave data in place with a retry, and sidebar
  hover (or, once the counts arrive, a short idle warm-up) prefetches the
  sections that have something waiting. No fetching indicator exists; the only
  trace of a refetch is `aria-busy`.
- **Loading is shaped like the result.** `QueryState` takes a `skeleton`
  matching the final rows, columns and heights (`skeletons.tsx`), so data
  arriving changes no layout.

## Planned

- **Staff questions over the reports** (optional, after the contest) — an
  admin-only chat that answers from the weekly figures and the moderation
  queue through a provider the municipality connects itself. Out of scope until
  the six required features are finished: a citizen assistant was built and
  removed because it added surface without serving any of them.
