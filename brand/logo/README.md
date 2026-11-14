# Ruta Cibao identity — round two

Selected direction: **01, winding asphalt road in perspective**. [Four generated concepts, exact prompts and selection rationale](concepts-v2/README.md). The first-round `concepts/` files are preserved.

One solid #1D9BF0 circle, one contained #0F1419 asphalt glyph, three white lane markings. The glyph has flat ends, a broad foreground and a substantial upper end; it never touches the circle. Dark asphalt was selected for stronger separation from blue. No edge stripes, gradients, shadows, raster embeds, live text or live strokes in the production mark. Existing outlined Outfit ExtraBold lettering is unchanged.

## Geometry and size rules

The road is authored from two cubic Bézier centreline segments, with width tapering from 280 to 144 units. The exporter constructs filled contours from their normals. All square mark SVGs have `viewBox="0 0 1024 1024"`. The three markings follow the same centreline, with flat inset ends.

**Use `mark-small.svg` at 16/32 px.** It replaces the dashes with one continuous 68-unit centre stripe (about one pixel at 16 px). Both favicon PNGs, `web/icon.svg`, and the notification cutout use this simplification. From 48 px upward use `mark.svg`.

## Files

- `mark.svg`: blue circle, ink road, white markings. `mark-small.svg`: continuous centreline.
- `mark-ink.svg`: ink circle, blue road, white markings.
- `mark-mono.svg` / `mark-white.svg`: black / white circles with a transparent road knockout and solid lane markings. Use on light / dark surfaces respectively.
- `streets.svg`: road and white markings alone, transparent canvas.
- `wordmark.svg`: original outlined Outfit ExtraBold. `lockup.svg` / `lockup-dark.svg`: blue badge with ink / white lettering, transparent canvas.
- `mark-{1024,512,192,48,32,16}.png`, `lockup-2000w.png`: transparent exports. 16/32 derive from the small mark.
- `ios/AppIcon-1024.png`: opaque RGB blue square, contained road. `AppIcon-1024-dark.png`: opaque ink square, blue road, white markings. `AppIcon-1024-tinted.png`: neutral grayscale road and white markings on transparency. No baked corner mask. `ios/app-icon-source.svg` is the light master.
- `android/ic_launcher_foreground.xml`: road plus markings, 108 dp viewport, entirely within the centered 66 dp safe circle. Blue is supplied independently by `colors.xml` (`ic_launcher_background`).
- `android/ic_launcher_monochrome.xml`: white road silhouette with transparent dashed lane cutouts, for system tint. `ic_notification.xml`: 24 dp white road silhouette, continuous transparent centreline from the small variant, 2 dp vertical margins.
- `android/*-preview.svg`: review equivalents of the exact VectorDrawable paths and transforms. `android/play-store-512.png`: opaque blue square.
- `web/icon.svg`: small circular mark. `apple-icon.png`: 180 px opaque blue square. `favicon-{32,16}.png`: small circular mark. `og-1200x630.png`: outlined lockup on white.
- `preview.html`: all assets on light and dark backgrounds, with real-size 16/32/48 px, Apple 180 px and Android 108/24 dp previews. Large exports are displayed at review sizes and link to their originals; the expandable appendix shows every image at intrinsic size with scrolling.
- `preview.png`: browser-rendered review sheet, 1440 × 3399 px. No console messages during rendering.

## Rebuild

```sh
bun scripts/brand/export-logo.ts
```

Uses installed sharp. Rebuilds all production SVGs, Android XMLs, PNGs, preview equivalents and `preview.html` from the authored geometry and existing `wordmark.svg`. Generated concepts and the browser screenshot are preserved; re-render the HTML to refresh the screenshot after a design edit.

For a deliberate wordmark edit only, `fonts/outline-wordmark.py` can recreate its paths. Original Outfit font and SIL Open Font License 1.1 remain in `fonts/`. Font source: [Google Fonts Outfit](https://github.com/google/fonts/tree/main/ofl/outfit), [upstream Outfit](https://github.com/Outfitio/Outfit-Fonts). Weight 800, tracking -18 font units; no runtime font loading.

## Validation and review

The exporter ran successfully. Scoped TypeScript checking and Biome checking passed. All 18 SVG/XML documents parse; SVGs contain no raster embeds or live text. All 15 production PNG dimensions were checked, along with opaque platform canvases, grayscale tint channels, transparent monochrome knockouts, identical small mark/favicon exports and the Android 66 dp safe circle. The review sheet was visually inspected, including the exact-size favicon row.

Native assets were reviewed as images and geometry; they have not been installed on devices. App build/test suites were not run for this asset-only handoff while another agent edits the apps. No app code, app resources, wordmark, font or first-round concept files were changed. No commit, push or PR.

**Human decision:** approve the winding-road direction and its continuous-line 16/32 px variant before the app agent wires in these assets. The iOS dark/tinted versions and Android themed silhouette remain subject to a native launcher review during integration.
