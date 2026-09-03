/**
 * Fetches the glyph pack the map style needs for its labels.
 *
 * MapLibre renders text from pre-rendered signed-distance-field glyphs, not
 * from a webfont, and it asks for them by URL. Hosted providers serve their
 * own; a self-hosted basemap has to ship them, and without them every label on
 * the map silently disappears.
 *
 * Only the families the style names are copied, plus the sprite its route
 * shields and icons need. The full pack carries scripts this province has no
 * use for and would multiply the size for nothing.
 *
 *   bun run basemap:fonts
 */

import { spawnSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";

const SOURCE =
  "https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip";
/**
 * Every family the generated style names.
 *
 * The official layer set uses all three weights, and a missing one does not
 * fall back — the labels using it silently vanish. Downloading only Regular is
 * how the map ended up with no place names at all.
 */
const FAMILIES = ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"];
const DESTINATION = "public/fonts";
const SPRITE_DESTINATION = "public/sprites";
/** Route shields, one-way arrows and POI icons come from here. */
const SPRITE_FILES = [
  "light.json",
  "light.png",
  "light@2x.json",
  "light@2x.png",
];
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

  const root = `${WORK}/basemaps-assets-main`;
  await mkdir(DESTINATION, { recursive: true });
  await mkdir(SPRITE_DESTINATION, { recursive: true });

  for (const family of FAMILIES) {
    await cp(`${root}/fonts/${family}`, `${DESTINATION}/${family}`, {
      recursive: true,
    });
  }
  // The fonts are OFL licensed; the licence travels with them.
  await cp(`${root}/fonts/OFL.txt`, `${DESTINATION}/OFL.txt`);

  for (const file of SPRITE_FILES) {
    await cp(`${root}/sprites/v4/${file}`, `${SPRITE_DESTINATION}/${file}`);
  }

  await rm(WORK, { recursive: true, force: true });
  console.log(`glyphs for ${FAMILIES.length} families in ${DESTINATION}`);
  console.log(`sprite in ${SPRITE_DESTINATION}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
