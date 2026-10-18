# Design language

Ruta Cibao uses the Genesis design system (warm paper, near-black ink, ink-tinted
rings and shadows, pills, small fast motion) with one accent of its own. This
file is the reference for every surface: the landing, the content pages and the
map. When a surface needs something it does not cover, add it here first.

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
| Status | `--success` `--warning` `--danger` | Always with an icon and words. Text uses `text-danger-ink` (the hue pulled toward ink) for 4.5:1. |
| Location | `--locate` | Genesis blue, for the "you are here" dot only. A map convention, not an accent. |
| Depth | `--ring` `--shadow-sm/md/lg` `--glass` | Cards take `shadow-ring`; floating things take `shadow-lg`; glass is for controls over the map. |
| Motion | `--ease-out` `--ease-in` `--ease-soft` `--ease-spring` | See Motion. |

Radii: pills `999px`, inputs `10px` (`rounded-input`), cards `16px`
(`rounded-card`), panels and sheets `24px` (`rounded-panel`), photo and map
frames `32px` (`rounded-frame`).

## Type

Inter (with `ss01`, `cv11` and optical sizing) for everything, Geist Mono 500
for small uppercase labels and figures. Weights are 400, 500 and 600, and
headlines are 450–500. The roles are utilities: `t-display`, `t-h2`, `t-h3`,
`t-body-lg`, `t-body`, `t-small`, `t-label`. Inputs stay at 16px so iOS does not
zoom on focus.

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
- **Province.** Everything outside the province is veiled with paper, labels
  included. Municipal lines are dashed, and municipality names are set in the
  mono label face.
- **Markers** are DOM elements styled with the interface tokens. They are not
  symbol layers, so they get real buttons, focus rings and transitions.
  - Places are round pins in their category colour.
  - Traffic points are square chips (road-sign shape).
  - Routes are footprints; open cases are speech marks.
  - Clusters are ink pills with a mono count. They come from the Postgres MVT
    tiles and are merged in screen space so no two markers overlap.
- **Selection.** The pin scales up, fills with its category colour, and shows
  its name in a glass pill.
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
