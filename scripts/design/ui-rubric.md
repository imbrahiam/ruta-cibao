# Ruta Cibao UI rubric

Score one screen, on one platform, in one appearance. The input is a pair of screenshots
(iOS and Android) plus this file. Score each criterion 0 to 10 and give the screen the
lowest criterion score, not the average: one broken thing breaks the screen.

The bar is a top-tier consumer app on Mobbin (Airbnb, Threads, Apple Maps, Cash App).
A 9 means a design lead at one of those would ship it unchanged. A 7 is "fine" and fails.

| # | Criterion | 10 looks like | Fails when |
|---|---|---|---|
| 1 | Density and dead space | Content starts right under the status bar or nav bar; no empty bands; every gap has a job | Empty rows above titles, back button alone on its own row, half-empty sheets |
| 2 | Hierarchy | One dominant element per screen, then a clear second level; the eye knows where to go | Two things compete, or everything is the same weight |
| 3 | Typography | A small, consistent scale; titles, body, captions are distinct; no orphan words, no clipping at 1.3x text | Mixed sizes for the same role, cramped or clipped lines |
| 4 | Spacing rhythm and alignment | Shared 4/8 pt grid, aligned leading edges, equal insets inside cards and lists | Ragged edges, uneven padding, off-grid gaps |
| 5 | Contrast and accessibility | WCAG 2.2 AA text and icons, 44 pt / 48 dp targets, state never colour-only | Grey on grey, tiny targets, selection shown by tint alone |
| 6 | Platform feel | iOS reads as iOS 26 (Liquid Glass, SF Symbols), Android as Material 3, both from one design language | A web page in an app shell, or iOS widgets on Android |
| 7 | Parity | Same information, order, labels and actions on both platforms | A row, icon, count or action exists on one only |
| 8 | Copy | Spanish (es-DO), short labels, no filler sentences, no truncation | Explanations nobody reads, cut-off labels |
| 9 | Dark mode | Same hierarchy in dark; no muddy greys, no pure-black slabs inside sheets | Text dark on dark, washed-out accents |
| 10 | Brand | Calm, photo-first, warm greys, iris accent used sparingly | Loud gradients everywhere, accent on everything |

Answer with JSON only:

```json
{"screen":"<name>","mode":"light|dark","ios":{"score":0,"worst":"<criterion #>","fixes":["<one concrete change>"]},
 "android":{"score":0,"worst":"<criterion #>","fixes":["<one concrete change>"]}}
```

Fixes name the element and the change ("Gestión: put the title on the back-button row and drop the 56 dp gap"),
not a principle ("improve spacing").
