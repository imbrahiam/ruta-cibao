/**
 * Fetches the glyph pack the map style needs for its labels.
 *
 * MapLibre renders text from pre-rendered signed-distance-field glyphs, not
 * from a webfont, and it asks for them by URL. Hosted providers serve their
 * own; a self-hosted basemap has to ship them, and without them every label on
 * the map silently disappears.
 *
 * Only the one family the style names is copied. The full pack carries scripts
 * this province has no use for and would multiply the size for nothing.
 *
 *   bun run basemap:fonts
 */

import { spawnSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";

const SOURCE =
  "https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip";
/** Must match the `text-font` in `@/lib/map/style` and `@/lib/map/layers`. */
const FAMILY = "Noto Sans Regular";
const DESTINATION = "public/fonts";
const WORK = ".tooling/basemaps-assets";

async function main() {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });

  const archive = `${WORK}/assets.zip`;
  const download = spawnSync("curl", ["-sL", "--fail", "-o", archive, SOURCE], {
    stdio: "inherit",
  });
  if (download.status !== 0) {
    console.error("could not download the font assets");
    process.exit(1);
  }

  const unzip = spawnSync("unzip", ["-q", "-o", archive, "-d", WORK], {
    stdio: "inherit",
  });
  if (unzip.status !== 0) {
    console.error("could not unpack the font assets");
    process.exit(1);
  }

  const root = `${WORK}/basemaps-assets-main/fonts`;
  await mkdir(DESTINATION, { recursive: true });
  await cp(`${root}/${FAMILY}`, `${DESTINATION}/${FAMILY}`, {
    recursive: true,
  });
  // The fonts are OFL licensed; the licence travels with them.
  await cp(`${root}/OFL.txt`, `${DESTINATION}/OFL.txt`);

  await rm(WORK, { recursive: true, force: true });
  console.log(`glyphs for "${FAMILY}" are in ${DESTINATION}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
