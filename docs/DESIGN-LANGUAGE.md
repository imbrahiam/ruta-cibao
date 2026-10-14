# Design language

One product, three surfaces: the landing, the content pages (Explorar,
Consultas, Mis aportes, Pasaporte, Mi cuenta, Rutas) and the map. This file is
the shared reference; when a surface needs something it does not cover, add it
here first.

It comes from a 2026-10-14 survey of the thirty galleries listed on
mkdir.directory (Awwwards, CSS Design Awards, land-book, minimal.gallery,
siteinspire, footer.design and the rest), filtered for civic portals, tourism,
parks, maps and mobile app UI, and weighed against who uses this app: rural
residents and visitors, many older, many on cheap Android phones over slow
data, reading Spanish with varying confidence.

## The overall reference: land-book

The owner chose land-book.com as the closest model for the whole product: a
curated directory you browse by category, search and filter — which is what
Explorar and the map are. What it contributes:

- **Palette.** Warm greys, not white: page `#f7f6f5`, soft tiles `#f0efed`,
  hairlines `#e6e6e3`, ink `#1d1c1c`, and one muted green accent. (land-book's
  grey text, `#868584`, is 3.4:1 — ours is darker to pass AA.) The accent stays
  the brand's forest green `#1f4d3f`; land-book's teal `#017c6e` also passes AA
  and is a one-token swap if the owner prefers it.
- **No shadows on the page.** Surfaces separate by tone (`bg-secondary` tiles on
  the page ground) and hairlines, never by drop shadow. Shadows are only for
  what floats over the map.
- **Navigation.** Pill nav; the active item is a soft grey pill with a small
  dot under it.
- **Search** as a centred pill, the most prominent control after the title.
- **Category tiles.** Large soft-grey rounded tiles (16 px radius), a picture
  inside, the label underneath; the active one gets the same dot.
- **Filter chips** in soft grey pills, the active one filled with ink.
- **A photo-card grid** for things you choose by looking (places, routes), with
  the title under the image rather than over it.

park.photos is a second reference the owner liked: calm, muted, photography
first, one pill call to action.

## References that shaped it

| Reference | What we take |
| --- | --- |
| Wellington City Council, Ville de Mascouche, LAPL | The home page asks a question and offers search plus direct tasks, not a slogan. Launcher rows of icon + verb. |
| Ville de Varennes, Brossard | A notice bar for what matters today (a closed road), orange while active, slate when lifted. |
| Felt | The product shown as a map of the place, with a small live card ("Abiertos · Resueltos esta semana"). Numbered feature rows on hairline rules. |
| Circulátelo (Cali) | A Spanish-language civic map: real counts in big numerals, a list that renders before the tiles. |
| Notranjski park | Status said three ways at once — icon, colour, word. |
| Places to Read, Chesas da cultura Engiadina | Directory rows: pictogram or thumb, name, town, chevron; the town on every row. |
| HUTS | Cream and forest green, line illustrations, a deep-green footer slab with rounded top corners. |
| Insel Hombroich | Search that opens on ready-made questions ("¿Cómo llego a la presa?"). |
| Tourisme Montréal, Spots Travel, Glossar | The passport: perforated stamps, a circular cancellation mark, dashed "page" borders. |
| Lugano Living Lab, Leedlime | A footer that says who runs the project and whether the data is live. |

Rejected for this audience, all seen in the galleries: splash or intro
screens, scroll-jacking and scroll-revealed text, WebGL or autoplay video
heroes, carousels that advance by themselves, cursor followers, marquees,
tiny all-caps mono paragraphs, icon-only buttons, colour-only status, bento
grids, cookie sheets and chat bubbles over the content, user-agent checks.
Cape Town Dam Levels was excluded by the owner.

## Foundations

**Colour.** Warm paper ground (`--background`), one ink (`--foreground`), and
the brand forest green (`--primary`, `#1f4d3f`) as the single colour that means
"you can press this". Category colours belong to the map, its chips and its
pins — never to page chrome. Road-alert amber and the traffic legend are the
only other saturated colours. A pale lime tint (`--highlight`) is for
illustration fills only, never text.

**Type.** Geist for everything, Geist Mono only for short numeric metadata
(counts, distances, dates, `01`–`06` indices) via `.meta-mono`. No serif: one
family keeps one voice and saves a download on slow data.

| Role | Class | Size |
| --- | --- | --- |
| Display (landing hero) | `.display-title` | 40 px phone → 72 px desktop, bold, −0.035em |
| Page title | `.page-title` | 30 → 36 px, semibold |
| Section title | `.section-title` | 22 → 28 px, semibold |
| Eyebrow | `.page-eyebrow` | 11 px caps, green — labels only, never sentences |
| Body | default | 16 px minimum; 17 px in rows |
| Big number | `.stat-number` | 40 → 56 px, tabular |

**Shape.** Rounded pills for buttons and chips (44 px minimum height, 48 px on
the landing). Photo cards in a grid for things you choose by looking (a place,
a route), title under the image; everything you look something up in (cases,
reports, settings) is a ruled list. Soft tiles (`bg-secondary`, 16 px radius)
group things; hairline rules (`.ruled > * + *`) separate rows. No drop shadows
on the page — only on things floating over the map.

**Status.** Always icon + word + colour, never colour alone:
Recibido (grey, circle) · En revisión (amber, half circle) · En proceso (blue,
play) · Resuelto (green, check) · No procede (muted red, cross). In a detail
view the badge expands into a vertical timeline.

**Motion.** `transform` and `opacity` only, 150–250 ms, one ease
(`--ease-out-soft`). Every animation sits inside
`@media (prefers-reduced-motion: no-preference)`, so the default is none.
Content never waits for an animation to become visible. No smooth-scroll or
animation libraries, no `backdrop-filter` on anything that moves (it is
expensive on low-end Android GPUs).

**Copy.** Spanish, verbs first, no filler (see the product-focus rule: nothing
that reassures or decorates). "Reporta un hoyo", not "Ayúdanos a construir una
mejor comunidad". All of it in `messages/es.json`.

## Surfaces

**Landing**, mobile first, one column:
1. Notice bar when a road is blocked right now (live data), dismissible.
2. Hero: a short question, one large search field that opens the map's search,
   and two direct tasks — "Abrir el mapa", "Reportar un problema". A real
   province photo, shorter than the screen, with the search card overlapping
   its bottom edge.
3. The province in real numbers: places, routes, reports resolved this month.
4. The territory: a flat drawing of the three municipalities from the real
   boundaries, the dam marked, with a small live card for open and resolved
   reports. Tapping it opens the map.
5. What you can do: numbered ruled rows `01`–`06`, one per feature, each a verb
   and one line, each a link.
6. Places to visit: a horizontal snap row of photo cards with ← → buttons and
   "Ver todo".
7. Footer: the deep-green slab.

**Lists** (Explorar, Consultas, Mis aportes, Rutas): 72–88 px rows — pictogram
in a tinted circle or a 64 px thumb, name (17 px semibold, two lines max),
"Municipio · categoría" muted, status badge or chevron at the edge. The whole
row is the target. Municipality filters are three segmented buttons. Skeleton
rows match real row height.

**Pasaporte**: a dashed-border page of perforated stamps with a circular
cancellation ("SANTIAGO RODRÍGUEZ · fecha"); places not yet visited are dashed
outlines with their names, so the goal is visible.

**Mi cuenta**: plain underlined rows under bold headings. No cards.

**Empty states**: a line illustration, one sentence, one action.

**Footer**: deep green slab with rounded top corners, the wordmark, short
links in large text, a status line ("En línea · datos al día" / "Sin conexión
— viendo datos guardados"), and the credits strip.

**Map**: the same tokens. Floating controls are 48 px white discs with a
hairline; the primary action is the green disc. See `src/lib/map/palette.ts`
for the basemap, which follows the same rule as the pages: quiet ground, the
province's content is the only colour.
