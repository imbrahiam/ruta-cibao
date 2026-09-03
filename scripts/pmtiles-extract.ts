/**
 * Cuts a basemap for the province out of the global Protomaps build.
 *
 * This is the handover path. A hosted tile provider is convenient while
 * building, but it is a key, a bill and a third party the municipality would
 * inherit. Protomaps publishes the whole planet as a single PMTiles file, and
 * the extractor reads it over HTTP range requests — so this pulls down only the
 * tiles covering Santiago Rodríguez, a few megabytes, and never the planet.
 *
 * What comes out is one file. Serve it from the same server as the app, point
 * NEXT_PUBLIC_BASEMAP_PMTILES_URL at it, and the map has no external
 * dependency, no quota and nothing to renew. It is also what makes the offline
 * story real: a file the service worker can cache is a map that works in a dead
 * zone.
 *
 *   bun run scripts/pmtiles-extract.ts
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

/** Matches PROVINCE_BOUNDS in `@/lib/map/config`, with a little margin. */
const BBOX = { west: -71.8, south: 19.1, east: -70.8, north: 19.8 };

/**
 * Street level. Past this the basemap adds detail nobody reads at walking pace
 * and multiplies the file size for it; the citizen layer keeps its own detail
 * at every zoom because it comes from Postgres, not from here.
 */
const MAX_ZOOM = 15;

/**
 * The Protomaps v4 planet build, mirrored by Source Cooperative.
 *
 * It is roughly 135 GB. None of that is downloaded: PMTiles is designed to be
 * read by HTTP range request, so the extractor fetches only the byte ranges
 * holding the tiles inside the bounding box below.
 */
const SOURCE = "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles";
const OUTPUT = "public/basemap/santiago-rodriguez.pmtiles";

/**
 * Where the extractor lives.
 *
 * A locally downloaded copy is preferred over one on PATH, so a contributor can
 * build the basemap without installing anything system-wide.
 */
const LOCAL_CLI = ".tooling/pmtiles";

function cli(): string {
  return existsSync(LOCAL_CLI) ? LOCAL_CLI : "pmtiles";
}

function explainMissingCli(): never {
  console.error(
    [
      "",
      "The `pmtiles` command was not found. It is a single Go binary from",
      "Protomaps, and one of these will install it:",
      "",
      "  brew tap protomaps/tap && brew install pmtiles",
      "  go install github.com/protomaps/go-pmtiles@latest",
      "",
      "Or drop the release binary at .tooling/pmtiles, which is gitignored and",
      "found automatically:",
      "  https://github.com/protomaps/go-pmtiles/releases",
      "",
      "It is only needed to build the file. Nothing at runtime depends on it,",
      "and the result is committed or copied to the server as a plain asset.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

function main() {
  if (spawnSync(cli(), ["version"], { stdio: "ignore" }).error) {
    explainMissingCli();
  }

  mkdirSync("public/basemap", { recursive: true });

  const bbox = `${BBOX.west},${BBOX.south},${BBOX.east},${BBOX.north}`;
  console.log(`extracting ${bbox} up to z${MAX_ZOOM}`);
  console.log(`  from ${SOURCE}`);
  console.log(`  to   ${OUTPUT}`);

  const result = spawnSync(
    cli(),
    ["extract", SOURCE, OUTPUT, `--bbox=${bbox}`, `--maxzoom=${MAX_ZOOM}`],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error("extraction failed");
    process.exit(result.status ?? 1);
  }

  if (!existsSync(OUTPUT)) {
    console.error("the extractor reported success but wrote no file");
    process.exit(1);
  }

  console.log(
    [
      "",
      "Done. To use it:",
      "",
      `  NEXT_PUBLIC_BASEMAP_PMTILES_URL=/basemap/${OUTPUT.split("/").pop()}`,
      "",
      "The style also needs glyphs for its labels. Copy a font pack into",
      "public/fonts/{fontstack}/{range}.pbf — the Noto Sans build from",
      "https://github.com/protomaps/basemaps-assets covers the style as written.",
      "",
    ].join("\n"),
  );
}

main();
