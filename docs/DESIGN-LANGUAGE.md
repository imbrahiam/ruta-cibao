# Design language

Ruta Cibao uses the Genesis design system (warm paper, near-black ink, ink-tinted
rings and shadows, pills, small fast motion) with one accent of its own, and
keeps two things from the first design: Fraunces headlines and a deep pine
surface. This file is the reference for every surface: the landing, the content
pages and the map. When a surface needs something it does not cover, add it
here first.

The app is light by default. Dark is an explicit choice in the account menu,
the layers sheet and Cuenta; it is kept working, but light is the design
target and is checked first.

## Tokens

All tokens live in `src/app/globals.css` and are mapped into Tailwind v4's
`@theme`, so components use `bg-paper`, `text-ink-2`, `shadow-ring`,
`rounded-card` and so on. Do not add a colour, size, radius or shadow that is
not a token.

| Group | Tokens | Notes |
| --- | --- | --- |
| Ink | `--ink` `--ink-2` `--ink-3` `--ink-4` | Light `--ink-3` is `#6F6C64`, not Genesis' `#8A877F`, which is 3.4:1 on paper and fails AA for captions. |
| Paper | `--paper` `--paper-2` `--paper-3` `--line` `--card` | Page, inset areas, chips and hover, hairlines, cards. |
| Accent | `--accent` `--accent-hover` `--accent-soft` `--on-accent` | "Pino" `#1F6B52` (dark `#5FBF9A`). Primary action and links only, at most one accent button per view. |
| Pine | `--pine` `--on-pine` | `#183F32` with paper text. The one coloured surface: the landing hero band and the footer. Never a button. |
| Status | `--success` `--warning` `--danger` | Always with an icon and words. Text uses `text-danger-ink` (the hue pulled toward ink) for 4.5:1. |
| Location | `--locate` | Genesis blue, for the "you are here" dot only. A map convention, not an accent. |
| Depth | `--ring` `--shadow-sm/md/lg` `--glass` | Cards take `shadow-ring`; floating things take `shadow-lg`; glass is for controls over the map. |
| Motion | `--ease-out` `--ease-in` `--ease-soft` `--ease-spring` | See Motion. |

Radii: pills `999px`, inputs `10px` (`rounded-input`), cards `16px`
(`rounded-card`), panels and sheets `24px` (`rounded-panel`), photo and map
frames `32px` (`rounded-frame`).

## Type

Inter (with `ss01`, `cv11` and optical sizing) for body and interface text,
Fraunces (optical size, `SOFT` 50) for the display and section headlines, and
Geist Mono 500 for small uppercase labels and figures. Weights are 400, 500 and
600, and headlines are 450–500. The roles are utilities: `t-display` and
`t-h2` (Fraunces), `t-h3`, `t-body-lg`, `t-body`, `t-small` (Inter), `t-label`
(mono). Inputs stay at 16px so iOS does not zoom on focus.

Every page opens with the same rhythm (`PageHeader`): a mono eyebrow, a
headline of eight words or fewer, and one sentence of lede.

## Layout

- Phones first. Content pages use a glass pill nav at the top (logo, bell,
  account) and a floating glass tab bar at the bottom: Mapa, Explorar,
  Consultas, Aportes, Cuenta. Icon and label are always shown, and the current
  section is a filled ink pill with `aria-current`.
- From 810px up the nav shows its links, the tab bar goes away, and an ink
  footer closes each page.
- Container: 1200px, with a 16px gutter on phones and 24px above 640px.

## The map

The map is the product, so it gets the most care. It must stay plain enough to
read at a glance.

- **Style.** `src/lib/map/style.ts` is written by hand for the Protomaps schema
  over the self-hosted PMTiles. There is no prebuilt style. The ground is paper
  and ink; vegetation and water are paper tinted toward the accent hue. Roads
  are told apart by width and casing, not by colour, so red, amber and green
  stay free for traffic. OSM points of interest are left out on purpose: the
  places on this map are the curated ones. Light and dark palettes are in
  `src/lib/map/palette.ts`, and `tests/map-style.test.ts` checks both.
- **Labels** use Inter and Geist Mono, from glyph packs built by
  `bun run basemap:glyphs`.
- **Chrome.** Two floating rows over the map: the search with a filter disc
  and the account beside it, then every category as icon and label. The active
  categories are marked by an ink underline, never by fill alone, and several
  can be on at once. It is the same rail at both sizes — icon over label on a
  phone, beside it on a desktop — so a category an official adds in the admin
  panel appears in both without a code change.
- **Province.** Nearby context is softly veiled as the camera closes in.
  Municipal polygons come from the exact OpenStreetMap administrative
  relations used by the basemap; their lines are dashed, and names use the
  mono label face.
- **Markers** are DOM elements styled with interface tokens, so they keep real
  buttons, focus rings and transitions.
  - At regional zoom, places, routes, cases and traffic are small coloured
    dots. Place clusters are accent circles with a mono count.
  - At street zoom, places become category-coloured pins: a circular icon over
    a narrow stem. Traffic becomes a road-sign chip.
  - At z15, collision-tested place names become compact side tags. Selecting a
    place hides the other tags and opens the draggable detail sheet.
  - Server MVT clustering plus a screen-space merge keeps markers from
    overlapping at broad zooms.
- **Selection.** The pin scales up, fills with its category colour, keeps its
  side tag, and suppresses unrelated labels while its sheet is open.
- **Sheets.** On phones a place or report opens in a Base UI drawer that snaps
  at 320px, 62% and 94% and never covers the whole map. On desktop the same
  content sits in a 400px floating panel on the left.
- **Picking a spot.** The pin stays fixed and the map moves under it
  (`PickFrame`). The map's padding follows the card, so the centre of the map
  is the crosshair.

## Motion

Small distances (12px or less), short durations (450ms or less), ease-out when
entering and ease-in when leaving.

- **Blur and rise** (`animate-rise`, `.stagger`) is used once per page, on
  entry.
- **Panel switch** (`animate-panel`) is used when a sheet's subject changes.
- **Press** (`press`) scales a control to 0.97 with a spring back.
- **Pins** pop in with a short blur.

`prefers-reduced-motion` turns all of these off. Motion never carries meaning on
its own.

## Components

Primitives are in `src/components/ui`, on Base UI (headless) for focus
management, swipe, snap points, menus and toasts. Magic UI is not used: Genesis
rules out decorative effects. Use the existing primitives before adding new
ones.
