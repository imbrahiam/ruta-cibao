/**
 * Filling in the municipal boundaries.
 *
 * Until this runs, "is this point in the province" is answered by a rectangle
 * drawn around it — which is wrong in both directions at once. The rectangle
 * this replaced reached 25 km into Valverde on one side and cut off the western
 * edge of Sabaneta on the other, so a citizen standing on Dominican ground near
 * the border was told their point was outside the province.
 *
 * The source is the three OpenStreetMap administrative relations used by the
 * Protomaps basemap: San Ignacio de Sabaneta 7390991, Villa Los Almácigos
 * 7390993 and Monción 7391002 (ODbL 1.0). Using the same geometry removes the
 * competing municipal lines that appeared when the former COD-AB shapes sat a
 * few hundred metres away from OSM. Their areas still match ONE's published
 * values (800.8, 207.1 and 138.9 km²).
 *
 * The reviewed polygons are kept in
 * `data/boundaries/santiago-rodriguez.geojson` and joined by ONE's P-code, not
 * by name. Normal imports are offline and deterministic. Refresh them
 * deliberately with `bun run scripts/fetch-boundaries.ts`, review the diff,
 * then import; a boundary must never change silently under a running platform.
 *
 *   bun run scripts/import-boundaries.ts
 *
 * Idempotent — it overwrites whatever is there with the same geometry.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { municipalities } from "@/db/schema";

const SOURCE = new URL(
  "../data/boundaries/santiago-rodriguez.geojson",
  import.meta.url,
);

type Ring = [number, number][];
type Feature = {
  properties: { id: string; pcode: string; name: string; areaSqKm: number };
  geometry:
    | { type: "Polygon"; coordinates: Ring[] }
    | { type: "MultiPolygon"; coordinates: Ring[][] };
};

function ringText(ring: Ring): string {
  return `(${ring.map(([x, y]) => `${x} ${y}`).join(",")})`;
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

const collection = (await Bun.file(SOURCE).json()) as {
  source: string;
  features: Feature[];
};
let written = 0;

for (const feature of collection.features) {
  const { id, pcode, name, areaSqKm } = feature.properties;
  const shape = multiPolygonText(feature);

  await db
    .update(municipalities)
    .set({
      boundary: shape,
      // The centroid of the real polygon, not a hand-picked point. It is what
      // the add-place form falls back to and what the map frames.
      center: sql`ST_Centroid(ST_GeomFromEWKT(${shape}))`,
    })
    .where(eq(municipalities.id, id));

  console.info(`  ${pcode} ${name} (${areaSqKm} km²) → ${id}`);
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

console.info(`\n${written}/${collection.features.length} written.`);
console.info(
  "province extent:",
  extent
    ? [extent.west, extent.south, extent.east, extent.north]
        .map((value) => Number(value).toFixed(4))
        .join(", ")
    : "none",
);
console.info(`\nBoundaries: ${collection.source}`);
process.exit(0);
