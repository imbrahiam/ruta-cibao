# Mobile and tourist passport continuation — 2026-10-13

> **Historical record. Superseded.** This document describes the web PWA,
> MapLibre basemap and cédula verification work as it stood on 2026-10-13. Those
> subsystems were removed when the product moved to the native app. The
> commands and paths below are not maintained and some no longer exist; use
> `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md` and `docs/MOBILE.md` for the
> current system.

This was the handoff for the interrupted mobile review. The older
`PRODUCTION-HANDOFF.md` records earlier infrastructure and identity work; its
port 3210 launcher is no longer present. Development is on port 3000. The local
production QA server used port 3211. Neither instance is a deployment.

## Completed

| Priority | Outcome | Implementation |
| --- | --- | --- |
| 5 | Expired cédula holds are rechecked under a row lock after the registry call. A holder who submitted photos while another request waited keeps their reservation. | The removed cédula module; its concurrency regression test was removed with it |
| 5 | MapLibre is the default in code, `.env.example`, Docker and Compose. Google remains an explicit deployment option. | `src/lib/env.public.ts`, `src/components/map/citizen-map.tsx`, `infra/` |
| 5 | Category filters also filter cluster counts, radii and hit targets; initial filters and selection apply when the map is ready. | `src/lib/tiles.ts`, `src/lib/map/layers.ts`, both map renderers |
| 5 | Software WebGL falls back to Leaflet. The Pixel emulator's Chrome uses SwiftShader; its vector canvas did not composite despite loaded tiles and successful GPU readback. The online raster fallback rendered successfully in production. | `src/lib/map/render-support.ts` |
| 4 | MapLibre canvas density is capped at 2, and unused Google/Leaflet renderers are loaded on demand. | map renderer components |
| 4 | Leaflet stays below floating controls; its initial extent matches the province, and its labels/errors use the catalogue. CARTO returned API-key watermarks, so the default fallback now uses OSM standard tiles. | `citizen-map-leaflet.tsx`, `src/lib/map/basemap.ts` |
| 4 | Google-only satellite, live traffic and POI controls are hidden on other renderers. Offline PMTiles download is hidden on the raster fallback. | `map-layers.tsx`, `offline-basemap.tsx` |
| 4 | Installation and the tourist passport are directly accessible from the map's overflow menu. Android native installation and home-screen launch without browser chrome were verified. | `map-actions.tsx`, existing install provider and standalone manifest |
| 4 | Tourist passport: one private stamp per published place, available to tourists and residents; page at `/pasaporte`, entry from account and place sheet. | `src/modules/passport/`, `src/components/passport/`, `src/orpc/routers/passport.ts` |

## Map polish — 2026-10-14

| Outcome | Implementation |
| --- | --- |
| The province is outlined, municipalities dashed and named, the rest of the country dimmed until street level — on MapLibre and the Leaflet fallback. | `provinceLayers()` in `src/lib/map/layers.ts`; boundaries route sends label points and the outside mask |
| A cluster cell holding one place is drawn as that place's pin and opens on the first tap. | `src/lib/tiles.ts`, the single-cluster layer constant |
| Traffic chips are dots below street zoom, so they stop covering pins; Leaflet chips are centred on their point (they were offset left). | `overlayChip()` in `overlay-features.ts`, `globals.css` |
| MapLibre no longer drops overlays, selection highlight or category filters that arrive while tiles load (`isStyleLoaded()` is false whenever any source is loading). | `citizen-map-maplibre.tsx` |
| Basemap POIs hidden; overflow "+" is primary-filled and clears the desktop zoom buttons. | `style.ts`, `map-actions.tsx` |
| Seeded places and municipality centres are OSM positions (Nominatim, 2026-10-14). | `scripts/seed.ts`, `scripts/seed-demo.ts` |

Run `bun run db:boundaries` on any database that has no municipal polygons;
without them the outline and names do not draw.

## Passport rules and privacy

The user confirmed a tourist passport with stamps for visiting places.
A stamp requires a reported GPS fix within 150 m, accuracy of 100 m or better,
and a timestamp no older than 60 seconds (5 seconds of clock skew allowed).
These are souvenir proximity checks, not tamper-resistant proof of presence.
There are no prizes, official certificates or public visit histories.

Destinations are encrypted at rest. A per-user keyed blind index deduplicates
visits; the account/place uniqueness constraint handles simultaneous retries.
Stamp creation and its audit event commit together. Coordinates are not saved
in stamps, audits or the idempotency ledger. A withdrawn place keeps its stamp
but does not expose withdrawn content. Deleting an account cascades to stamps.

Migration `0027_passport-stamps.sql` is forward-only and was applied to the
local development database. Apply it through the normal migrator before
shipping the API to another environment. No applied migration was edited.

## Validation

- `bun run typecheck`, `bun run lint`, `bun run build`, `bun test`: passed.
- Default suite: 147 passed; opt-in database/storage suites skip by design.
- `RUN_DB_TESTS=1 bun test tests/passport.integration.test.ts`: 4 passed,
  covering anonymous access, proximity, unpublished places, concurrent retries,
  encrypted storage, private reads, audit count and archived content.
- `RUN_DB_TESTS=1 JCE_USE_MOCK=1 bun test tests/cedula-hold.integration.test.ts`
  (removed with the cédula flow): passed the lock/concurrent-review regression.
  No live registry lookup.
- Collaborative browser at Pixel dimensions: place-sheet expansion, stamp
  creation with a fictional visitor and simulated GPS, and persisted passport
  display were verified. The temporary account and stamp were removed.
- Android 16 Pixel emulator, Chrome 133: production raster map, native install
  dialog, home-screen shortcut and launch without Chrome's toolbar verified.
- iOS 26.3 iPhone 17 Pro: Safari vector map, installed web-app full-screen
  view, search with the native keyboard, place selection, sheet expansion/close,
  native location permission and recentering with simulated province coordinates
  verified. Safari 26 installation instructions now mention the More menu.
- `droast infra/Dockerfile --no-roast --format compact` could not run:
  `droast` is absent, and `bunx droast` resolves to an npm 404. Docker image
  rebuild/roast verification remains a CI/release task.

The raster fallback requested only visible OSM tiles through the browser and
honoured normal HTTP caching. It was removed with the web map; the native app
has its own map and offline snapshot. See https://operations.osmfoundation.org/policies/tiles/ for the retired tile policy.

## Remaining tasks by priority

Priority is engineering impact: 5 blocks release, 1 is optional polish.

| Priority | Task | Dependency / acceptance |
| --- | --- | --- |
| 5 | Production delivery and secrets | Configure existing Twilio SMS and Resend email, real origins, storage and push keys. Confirm Dominican-number OTP delivery, expiry, retries and iOS/Android autofill. Keep secrets out of the repo. |
| 5 | Full production CI and recovery rehearsal | Run current Docker targets, image budgets, droast, identity/private-storage suites, encrypted backup plus full database/object-storage restore. Earlier handoff details ownership. |
| 5 | Real-device identity review | Verify camera/gallery upload, cancellation, rejection/resubmission and scoped moderation on real HTTPS. Registry cache/quota and mock-only development remain mandatory. |
| 4 | Physical iOS and Android QA | Simulator checks passed. Confirm camera, SMS autofill, passkeys, push and queued-report recovery on physical phones over the real HTTPS origin. |
| 4 | Mobile performance measurement | Compare cold/warm production loads on a mid-range physical Android over Slow 4G; record bytes, time until map usable and gesture responsiveness. Emulator SwiftShader results do not establish physical-device FPS. |
| 4 | Catalogue and passport field QA | Try denied/coarse GPS on physical phones, long place names, account switch, no signal and subsequent recovery. Passport stamps require a live server; there is no offline stamp queue. |
| 3 | Ecotourism route content | Await the routes the user will provide. Existing submission/moderation/directory support is present; do not fabricate official routes or distances. Validate the supplied paths and municipality ownership before publishing. |
| 2 | Recapture PWA screenshots on staging | The PWA screenshot pipeline was removed with the PWA; this item is closed |
| 1 | Optional passport expansion | Municipality milestones, share cards or prize programmes require separately agreed requirements and review of visit verification. Current stamps stay private. |

## SMS and iOS

SMS already uses Twilio's REST API, without another identity provider. Delivery
is disabled without a provider when `AUTH_LOG_DELIVERY=0`. Keep that setting
in production; the explicit log-delivery opt-in is for demos only.
The OTP input uses `autocomplete="one-time-code"` and a numeric keyboard.
iOS installation uses Safari's Share → Add to Home Screen flow; it has no
`beforeinstallprompt`. The installed app uses standalone display and retains
native Apple Maps directions on iOS.
