/**
 * Renders the app icon, splash mark and Android adaptive layers from the shared
 * mark geometry (`@ruta/shared/brand`), so the brand has a single source.
 *
 *   bun run apps/mobile/scripts/generate-brand-assets.ts
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
import sharp from "sharp";

const OUT = path.join(import.meta.dirname, "../assets/images");
const SIZE = MARK.viewBox;

/** The mark scaled about the canvas centre, in `color` with `accent` details. */
function mark(color: string, accent: string, scale: number): string {
  const offset = (SIZE * (1 - scale)) / 2;
  return `
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${MARK.road}" stroke="${color}" stroke-width="${MARK.roadWidth}" />
      <path d="${MARK.road}" stroke="${accent}" stroke-width="${MARK.laneWidth}"
        stroke-dasharray="${MARK.laneDash.join(" ")}" />
    </g>
    <circle cx="${MARK.start.cx}" cy="${MARK.start.cy}" r="${MARK.start.r}" fill="${color}" />
    <circle cx="${MARK.start.cx}" cy="${MARK.start.cy}" r="${MARK.start.inner}" fill="${accent}" />
    <path d="${MARK.pin}" fill="${color}" />
    <circle cx="${MARK.pinDot.cx}" cy="${MARK.pinDot.cy}" r="${MARK.pinDot.r}" fill="${accent}" />
  </g>`;
}

function canvas(body: string, background = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${background}${body}</svg>`;
}

const tile = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BRAND_COLORS.pineLight}" />
      <stop offset="1" stop-color="${BRAND_COLORS.pine}" />
    </linearGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="url(#g)" />`;

async function render(svg: string, file: string, size: number = SIZE) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(OUT, file));
  console.log(`wrote ${file}`);
}

await mkdir(OUT, { recursive: true });
await render(
  canvas(mark(BRAND_COLORS.paper, BRAND_COLORS.pine, 0.86), tile),
  "icon.png",
);
await render(
  canvas(mark(BRAND_COLORS.pine, "#FAFAF7", 0.9)),
  "splash-icon.png",
  512,
);
// Android adaptive icon: the foreground stays inside the 66% safe zone.
await render(
  canvas(mark(BRAND_COLORS.paper, BRAND_COLORS.pine, 0.56)),
  "android-icon-foreground.png",
);
await render(
  canvas(mark("#FFFFFF", "#000000", 0.56)),
  "android-icon-monochrome.png",
);
