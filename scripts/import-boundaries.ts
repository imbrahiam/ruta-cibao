/**
 * Filling in the municipal boundaries.
 *
 * Until this runs, "is this point in the province" is answered by a rectangle
 * drawn around it — which is wrong in both directions at once. The rectangle
 * this replaced reached 25 km into Valverde on one side and cut off the western
 * edge of Sabaneta on the other, so a citizen standing on Dominican ground near
 * the border was told their point was outside the province.
 *
 * The source is geoBoundaries gbOpen (ADM2, 2020), pinned to a commit rather
 * than tracking `current`: a boundary that changes silently under a running
 * platform is worse than one that is a year old. It is CC-BY, which is why the
 * attribution below is in the file and on the map.
 *
 *   bun run scripts/import-boundaries.ts
 *
 * Idempotent — it overwrites whatever is there with the same geometry.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { municipalities } from "@/db/schema";

const SOURCE =
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/DOM/ADM2/geoBoundaries-DOM-ADM2.geojson";

/**
 * What geoBoundaries calls each municipality, and what this database does.
 *
 * Matched by name because that is the only stable join available: the shape ids
 * are release-scoped and change between versions.
 */
const NAMES: Record<string, string> = {
  "San Ignacio de Sabaneta": "sabaneta",
  Monción: "moncion",
  "Los Almácigos": "villa-los-almacigos",
};

type Ring = [number, number][];
type Feature = {
  properties: { shapeName: string };
  geometry:
    | { type: "Polygon"; coordinates: Ring[] }
    | { type: "MultiPolygon"; coordinates: Ring[][] };
};

function ringText(ring: Ring): string {
  // Six decimals is about 10 cm, far past what a boundary file resolves and
  // enough to keep the payload small.
  return `(${ring.map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`).join(",")})`;
}

function multiPolygonText(feature: Feature): string {
  const polygons =
    feature.geometry.type === "MultiPolygon"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];

  const body = polygons
    .map((rings) => `(${rings.map(ringText).join(",")})`)
    .join(",");

  return `SRID=4326;MULTIPOLYGON(${body})`;
}

console.info("downloading boundaries…");
const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`geoBoundaries responded ${response.status}`);
  process.exit(1);
}

const collection = (await response.json()) as { features: Feature[] };
const wanted = new Map(Object.entries(NAMES));
let written = 0;

for (const feature of collection.features) {
  const id = wanted.get(feature.properties.shapeName.trim());
  if (!id) continue;

  await db
    .update(municipalities)
    .set({
      boundary: multiPolygonText(feature),
      // The centroid of the real polygon, not a hand-picked point. It is what
      // the add-place form falls back to and what the map frames.
      center: sql`ST_Centroid(ST_GeomFromEWKT(${multiPolygonText(feature)}))`,
    })
    .where(eq(municipalities.id, id));

  console.info(`  ${feature.properties.shapeName.trim()} → ${id}`);
  written += 1;
}

const extents = await db.execute<{
  west: number;
  south: number;
  east: number;
  north: number;
}>(sql`
  select
    ST_XMin(box) as west, ST_YMin(box) as south,
    ST_XMax(box) as east, ST_YMax(box) as north
  from (select ST_Extent(boundary) as box from municipalities) as e
`);

const extent = extents.rows[0];

console.info(`\n${written}/${wanted.size} written.`);
console.info(
  "province extent:",
  extent
    ? [extent.west, extent.south, extent.east, extent.north]
        .map((value) => Number(value).toFixed(4))
        .join(", ")
    : "none",
);
console.info(
  "\nBoundaries © geoBoundaries (gbOpen, CC-BY 4.0) — www.geoboundaries.org",
);
process.exit(0);
