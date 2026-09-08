/**
 * Cuts basemaps for the province and the country out of the global Protomaps
 * build.
 *
 * This is the handover path. A hosted tile provider is convenient while
 * building, but it is a key, a bill and a third party the municipality would
 * inherit. Protomaps publishes the whole planet as a single PMTiles file, and
 * the extractor reads it over HTTP range requests — so this pulls down only the
 * tiles covering Santiago Rodríguez, a few megabytes, and never the planet.
 *
 * What comes out is one file per region. Serve one from the same server as the
 * app, point NEXT_PUBLIC_BASEMAP_PMTILES_URL at it, and the map has no external
 * dependency, no quota and nothing to renew. It is also what makes the offline
 * story real: a file the service worker can cache is a map that works in a dead
 * zone.
 *
 *   bun run scripts/pmtiles-extract.ts              # both regions
 *   bun run scripts/pmtiles-extract.ts provincia    # just the small one
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

/**
 * What to cut, and how much it costs.
 *
 * Two archives rather than one, because they answer different questions. The
 * province is what the app is for today and what a phone on a metered plan can
 * reasonably save for offline use. The country is the same map ready for the
 * day another municipality asks to join — at street level it is ~57 MB, which
 * is a Wi-Fi download but a small one, and cutting it now means expansion is a
 * change of environment variable rather than a new build of anything.
 *
 * Both boxes carry a little margin. The province box matches PROVINCE_BOUNDS
 * in `@/lib/map/config`; the country box is drawn tight around the island's
 * Dominican side so the strip of Haiti and the open sea stay thin — sea tiles
 * are nearly free, but the west edge is where the file would grow for nothing.
 */
const REGIONS = {
  provincia: {
    bbox: { west: -71.8, south: 19.1, east: -70.8, north: 19.8 },
    output: "public/basemap/santiago-rodriguez.pmtiles",
  },
  pais: {
    bbox: { west: -72.05, south: 17.4, east: -68.2, north: 20.0 },
    output: "public/basemap/republica-dominicana.pmtiles",
  },
} as const;

type Region = keyof typeof REGIONS;

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

function extract(region: Region) {
  const { bbox: box, output } = REGIONS[region];
  const bbox = `${box.west},${box.south},${box.east},${box.north}`;
  console.log(`extracting ${region}: ${bbox} up to z${MAX_ZOOM}`);
  console.log(`  from ${SOURCE}`);
  console.log(`  to   ${output}`);

  const result = spawnSync(
    cli(),
    ["extract", SOURCE, output, `--bbox=${bbox}`, `--maxzoom=${MAX_ZOOM}`],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error(`extraction of ${region} failed`);
    process.exit(result.status ?? 1);
  }

  if (!existsSync(output)) {
    console.error("the extractor reported success but wrote no file");
    process.exit(1);
  }
}

/**
 * Which regions to cut: every one by default, or the ones named.
 *
 *   bun run basemap
 *   bun run basemap -- provincia
 */
function requestedRegions(): Region[] {
  const named = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  if (named.length === 0) return Object.keys(REGIONS) as Region[];

  const unknown = named.find((name) => !(name in REGIONS));
  if (unknown) {
    console.error(
      `unknown region "${unknown}"; expected one of ${Object.keys(REGIONS).join(", ")}`,
    );
    process.exit(1);
  }
  return named as Region[];
}

function main() {
  if (spawnSync(cli(), ["version"], { stdio: "ignore" }).error) {
    explainMissingCli();
  }

  mkdirSync("public/basemap", { recursive: true });

  const regions = requestedRegions();
  for (const region of regions) extract(region);

  console.log(
    [
      "",
      "Done. Serve one of them as the basemap:",
      "",
      ...regions.map(
        (region) =>
          `  NEXT_PUBLIC_BASEMAP_PMTILES_URL=/basemap/${REGIONS[region].output.split("/").pop()}   # ${region}`,
      ),
      "",
      "The country file is the same map with room to grow; the province file",
      "is the small one a phone can save for offline use.",
      "",
      "The style also needs glyphs for its labels. Copy a font pack into",
      "public/fonts/{fontstack}/{range}.pbf — the Noto Sans build from",
      "https://github.com/protomaps/basemaps-assets covers the style as written.",
      "",
    ].join("\n"),
  );
}

main();
