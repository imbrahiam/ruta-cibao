/**
 * Regenerate native and web identity assets from the shared Encuentro geometry.
 * Run: bun run apps/mobile/scripts/generate-brand-assets.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
import sharp from "sharp";

const MOBILE_OUT = path.join(import.meta.dirname, "../assets/images");
const WEB_OUT = path.join(import.meta.dirname, "../../web/src/app");
const SIZE = MARK.viewBox;

function mark(color: string, scale = 1) {
  const offset = (SIZE * (1 - scale)) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none"><path d="${MARK.curve}" stroke="${color}" stroke-width="${MARK.strokeWidth}" stroke-linecap="round"/><circle cx="${MARK.point.cx}" cy="${MARK.point.cy}" r="${MARK.point.r}" fill="${color}"/></g>`;
}

function canvas(body: string, background = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"><title>Ruta Cibao</title>${background}${body}</svg>`;
}

async function render(svg: string, destination: string, size: number) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(destination);
  console.log(`wrote ${path.relative(process.cwd(), destination)}`);
}

const tile = `<rect width="${SIZE}" height="${SIZE}" fill="${BRAND_COLORS.iris}"/>`;
const appIcon = canvas(mark(BRAND_COLORS.white), tile);

await mkdir(MOBILE_OUT, { recursive: true });
await mkdir(WEB_OUT, { recursive: true });
await render(appIcon, path.join(MOBILE_OUT, "icon.png"), 1024);
await render(
  canvas(mark(BRAND_COLORS.iris)),
  path.join(MOBILE_OUT, "splash-icon.png"),
  512,
);
// Keep the complete silhouette inside Android's central 66dp safe circle on a 108dp layer.
const adaptiveForeground = canvas(mark(BRAND_COLORS.white, 0.64));
await render(
  adaptiveForeground,
  path.join(MOBILE_OUT, "android-icon-foreground.png"),
  1024,
);
await render(
  adaptiveForeground,
  path.join(MOBILE_OUT, "android-icon-monochrome.png"),
  1024,
);
await render(appIcon, path.join(WEB_OUT, "apple-icon.png"), 180);
await writeFile(
  path.join(WEB_OUT, "icon.svg"),
  canvas(
    mark(BRAND_COLORS.white),
    `<rect width="${SIZE}" height="${SIZE}" rx="56" fill="${BRAND_COLORS.iris}"/>`,
  ),
);
console.log("wrote apps/web/src/app/icon.svg");
