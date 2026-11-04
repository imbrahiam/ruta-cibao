/**
 * Regenerate the identity assets from the shared Encuentro geometry: the web
 * favicon SVG and Apple touch icon, and the iOS app icon (the same mark).
 * Run: bun run scripts/generate-brand-assets.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BRAND_COLORS, MARK } from "@ruta/shared/brand";
import sharp from "sharp";

const WEB_OUT = path.join(import.meta.dirname, "../apps/web/src/app");
const IOS_ICON = path.join(
  import.meta.dirname,
  "../apps/ios/Resources/Illustrations.xcassets/AppIcon.appiconset/icon-1024.png",
);
const SIZE = MARK.viewBox;

function mark(color: string, scale = 1) {
  const offset = (SIZE * (1 - scale)) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none"><path d="${MARK.curve}" stroke="${color}" stroke-width="${MARK.strokeWidth}" stroke-linecap="round"/><circle cx="${MARK.point.cx}" cy="${MARK.point.cy}" r="${MARK.point.r}" fill="${color}"/></g>`;
}

function canvas(body: string, background = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}"><title>Ruta Cibao</title>${background}${body}</svg>`;
}

const tile = `<rect width="${SIZE}" height="${SIZE}" fill="${BRAND_COLORS.iris}"/>`;

await mkdir(WEB_OUT, { recursive: true });
await sharp(Buffer.from(canvas(mark(BRAND_COLORS.white), tile)))
  .resize(180, 180)
  .png()
  .toFile(path.join(WEB_OUT, "apple-icon.png"));
console.log("wrote apps/web/src/app/apple-icon.png");
await writeFile(
  path.join(WEB_OUT, "icon.svg"),
  canvas(
    mark(BRAND_COLORS.white),
    `<rect width="${SIZE}" height="${SIZE}" rx="56" fill="${BRAND_COLORS.iris}"/>`,
  ),
);
console.log("wrote apps/web/src/app/icon.svg");

// iOS masks the corners itself and rejects alpha: a full, opaque square,
// the mark inset so the squircle mask never clips the dot.
await sharp(Buffer.from(canvas(mark(BRAND_COLORS.white, 0.7), tile)))
  .resize(1024, 1024)
  .flatten({ background: BRAND_COLORS.iris })
  .removeAlpha()
  .png()
  .toFile(IOS_ICON);
console.log("wrote apps/ios/.../AppIcon.appiconset/icon-1024.png");
