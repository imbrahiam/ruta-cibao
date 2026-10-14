# Mobile UX review

How Ruta Cibao behaves on a phone, compared against the patterns people
already know from the map and civic-reporting apps they use every day — Google
Maps, Apple Maps, Waze, and 311-style reporting apps such as FixMyStreet. The
benchmark matters because the contest scores "usable without training": every
place this app behaves like the apps a citizen already knows is a place they
do not have to learn.

This is a review of the source, not of a device session. Findings marked
**verify on device** are inferences from the code that need a real phone on a
real connection to confirm.

## Where the app already matches the convention

| Pattern | What people expect | What Ruta Cibao does | Where |
| --- | --- | --- | --- |
| Full-bleed map | Map takes the whole screen; chrome floats over it | No header on `/mapa`; search and chips float; nav is a bottom bar | `src/app/[locale]/(map)/layout.tsx` |
| Search | A pill at the top that opens a full-screen search | Same: the pill opens a drawer with the input focused, `enterKeyHint="search"` | `src/components/map/map-search.tsx` |
| Category filters | One row of icon + label chips that scrolls sideways | Same, with an edge fade and a "Todo" chip so filtering can never empty the map | `src/components/map/category-chips.tsx` |
| Place details | Bottom sheet with a peek and a full state; tapping another pin swaps the content | Same, and the sheet never remounts, so it slides once and then only cross-fades | `src/components/map/place-drawer.tsx` |
| Primary action on a place | One prominent button (directions), the rest behind an overflow | "Cómo llegar" opens the platform's own maps app; save, share and report sit behind "…" | `place-drawer.tsx` |
| Choosing a location | Fixed pin; the map moves under it ("drop a pin" in Uber, Google) | Same, with the crosshair raised so the confirm card does not cover it | `src/components/map/pick-location.tsx` |
| Map controls | Locate button bottom-right, layers bottom-left | Same | `map-actions.tsx`, `map-layers.tsx` |
| Back gesture | Android back closes the sheet, not the app | The open place and report live in the URL with `history: push` | `map-screen.tsx` |
| Shareable state | A link reopens exactly this view | Every view setting is a URL parameter; defaults write nothing | `map-screen.tsx`, `use-view-preferences.ts` |
| Sign-in code | Numeric keypad, autofill from SMS, resend timer | `inputMode="numeric"`, `autoComplete="one-time-code"`, countdown before resend; passkeys when available | `src/components/onboarding/sign-in-form.tsx` |
| Working without signal | Reports saved and sent later, with a place to see what is waiting | IndexedDB queue, Background Sync on Android, `/pendientes` | `src/lib/offline/`, `pending-submissions.tsx` |
| Photo upload | The OS offers both camera and gallery | No `capture` attribute, deliberately | `place-photos.tsx` |
| Phone ergonomics | 44 px targets, no zoom-on-focus, safe areas, keyboard does not cover inputs | 44 px floor on coarse pointers, 16 px inputs, `env(safe-area-inset-*)`, `interactiveWidget: resizes-content`, pinch-zoom kept | `globals.css`, `src/app/[locale]/layout.tsx` |
| Motion | Respects the system's reduced-motion setting | Global `prefers-reduced-motion` override; no state shown by motion alone | `globals.css` |

That covers the shape of the app. The problems below are about cost, feedback
and interruption, not about the basic layout.

## What was wrong, and what changed

Every problem found in the first review has been addressed in code. They're
listed in the order they were ranked.

| # | Problem | What changed | Where |
| --- | --- | --- | --- |
| 1 | First visit downloaded ~15 MB in the background (852 precache entries, 769 of them map-label glyphs) | Glyphs, sprites, basemaps and seed photos are out of the precache. Glyphs and sprites are cached as the map uses them. **74 entries, 4.0 MB uncompressed, ~1.1 MB gzipped** | `src/app/serwist/[path]/route.ts`, `src/app/sw.ts` |
| 2 | The offline notice sat 5rem from the bottom, under the nav on iPhones, and covered the map's corner controls. (The first review said there was no notice at all. That was wrong: `offline-indicator.tsx` existed.) | Positioned from `--mobile-nav-height` everywhere. On the map it moves under the search row, where people look when the map stops loading. Amber when offline | `src/components/offline/offline-indicator.tsx`, `map-screen.tsx` |
| 3 | A full-screen install offer on the first visit, before the person had seen anything | Shown only after something useful: a report sent or queued, a place saved. It's a dismissible card over the bottom of the map that doesn't take focus. Still once a month at most | `install-splash.tsx`, `src/lib/install-moment.ts` |
| 4 | Address search hit the public geocoder on every keystroke, against its usage policy | Places still answer as you type. Addresses are asked for only on submit (keyboard search key or "Buscar … como dirección"). The server caches answers for 24 h and spaces requests ≥1.1 s apart app-wide. Recent searches (on the device only) fill the empty state; names wrap to two lines | `map-search.tsx`, `src/lib/geocode.ts`, `places.search` |
| 5 | The place sheet's peek covered 55% of the screen | Three snap points, 36% / 62% / 94%. The expand button steps through them | `place-drawer.tsx` |
| 6 | Toasts covered the search bar. They also turned dark on phones set to dark mode, over a light app | At the bottom above the nav on phones, top-centre on desktop. Always light | `src/components/shell/app-toaster.tsx` |
| 7 | A bottom tab was spent on the marketing page; reporting had no home | Phone tabs: Mapa · Explorar · Mis aportes · Consultas · Mi cuenta. Desktop keeps Inicio. Sections stay highlighted on their sub-pages, and the active tab is a filled pill | `src/components/shell/site-nav.tsx` |
| 8a | No manifest screenshots; no shortcut for the urgent action | A "Reportar tránsito" shortcut opens the map straight into picking (`/mapa?reportar=transito`). Screenshots are listed automatically once `bun run screenshots` has captured them from a running instance | `src/app/manifest.ts`, `scripts/capture-screenshots.ts` |
| 8b | Double bottom padding on the pick card | Phone padding no longer adds the home-indicator inset twice | `pick-location.tsx` |
| 8c | A hand-built "+" menu | The shared `DropdownMenu`: focus handling, arrow keys, typeahead, outside-click, and the same look as the place sheet's menu | `map-actions.tsx` |
| 8d | Dark colours were shadcn's grey defaults | Real brand values, ready for when a toggle and a dark map style are added. The app still ships light only | `globals.css` |
| 8e | Google as the default renderer | MapLibre is now the default in code, the example environment and Docker. Google remains an explicit option; software WebGL uses the online raster fallback | `docs/DEPLOYMENT.md` |

Earlier fixes, from before the ranked list: the place sheet no longer needs a
drag (WCAG 2.5.7), the focus ring is visible (4.5:1), there is one
bottom-nav height, and the "+" menu works from a keyboard.

## Visual polish across routes

- **One type scale for pages.** `page-eyebrow`, `page-title` and `page-lede`
  in `globals.css`. Every route had picked its own title size, from
  `text-2xl` to `text-4xl`.
- **Shapes instead of spinners while loading.** Skeleton grids and lists
  (`src/components/shell/list-skeleton.tsx`) on Explorar, Consultas, Mis
  aportes and Rutas, so nothing jumps when content arrives.
- **One floating-control family on the map.** The search pill, "+",
  locate and layers buttons share a disc, hairline, shadow and press state.
- **Cards that respond.** Place, consultation, route and account cards lift
  slightly on hover, with an icon tile and a semibold title.
- **Calmer shell.** A frosted sticky header, 64 px tall on phones instead of
  80 px, less dead space above page titles, and brand-tinted neutrals instead
  of pure greys.
- **Empty and error states.** An icon tile, a title and one rounded action,
  the same pattern everywhere.

## Still to check on a device

The original review was source-only. The 2026-10-13 continuation verified the
production map and native install prompt on the Android 16 Pixel emulator,
and the passport flow in the collaborative browser at Pixel dimensions.
The user then installed iOS 26.3, and Safari, the installed web-app view,
native search keyboard and place sheet were verified on iPhone 17 Pro.
Before release:

- ~~Take a long place name on a 360 px-wide Android and an iPhone SE.~~
  Verified in emulation on 2026-10-14 (360×740 and 375×667): the peek holds
  the two-line title and "Cómo llegar". It also showed the map's "+" half
  under the sheet; the floating column now fades out while a sheet is open
  on a phone. Recheck on hardware.
- ~~Go offline and check the map's notice, then reconnect.~~ Verified in
  emulation: the amber notice appears under the search row and clears. A
  *queued report* while offline still needs a real device.
- Send a traffic report on a phone and check the install card appears after
  the success toast, not over it.
- Run `bun run screenshots` against staging, then rebuild so the manifest
  carries them.

Measure on a mid-range Android over throttled "Slow 4G": first-visit
transfer, time until the map is usable, and whether a first-time user can file
a traffic report without help.
