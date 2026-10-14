import { isNotNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { db } from "@/db";
import { municipalities } from "@/db/schema";
import { COUNTRY_BOUNDS } from "@/lib/map/config";

/**
 * The province, as it actually is.
 *
 * One payload doing three jobs, which is why it is a route rather than three
 * queries: the map draws the outline, the point picker tests a coordinate
 * against it while the map is being dragged, and the add-place form reads which
 * municipality a point fell in. Doing that last one with a round trip per pan
 * would be absurd; the polygons are 30 KB and change once a decade.
 *
 * `ST_AsGeoJSON` in the database rather than a conversion in TypeScript —
 * PostGIS already speaks this format and the alternative is a parser nobody
 * asked for.
 *
 * Boundaries: Oficina Nacional de Estadística via OCHA COD-AB (CC BY-IGO).
 * Imported by
 * `scripts/import-boundaries.ts`.
 */
export const MUNICIPAL_BOUNDARIES_TAG = "municipal-boundaries";

async function collection() {
  "use cache";
  cacheTag(MUNICIPAL_BOUNDARIES_TAG);
  // Administrative boundaries are redrawn by law, not by traffic.
  cacheLife("days");

  const rows = await db
    .select({
      id: municipalities.id,
      name: municipalities.name,
      // Simplified to ~11 m for the wire: the official polygons are ~260 KB,
      // which a phone on rural data should not pay for an outline. The
      // database keeps full precision, and its ST_Contains is the authority on
      // submit; this copy only draws the map and guesses while dragging.
      geometry: sql<string>`ST_AsGeoJSON(ST_SimplifyPreserveTopology(${municipalities.boundary}, 0.0001), 5)`,
      // Inside the polygon by construction, unlike a centroid — a horseshoe
      // municipality's centroid can land in its neighbour.
      label: sql<string>`ST_AsGeoJSON(ST_PointOnSurface(${municipalities.boundary}))`,
    })
    .from(municipalities)
    .where(isNotNull(municipalities.boundary));

  // Everything in the country that is not the province, so the map can dim it
  // and the three municipalities read as the subject rather than a region of
  // a general-purpose map.
  const [west, south, east, north] = COUNTRY_BOUNDS;
  const [outside] = rows.length
    ? await db
        .select({
          geometry: sql<string>`ST_AsGeoJSON(ST_Difference(
            ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326),
            ST_SimplifyPreserveTopology(ST_Union(${municipalities.boundary}), 0.0001)
          ), 5)`,
        })
        .from(municipalities)
        .where(isNotNull(municipalities.boundary))
    : [];

  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      id: row.id,
      properties: {
        id: row.id,
        name: row.name,
        label: (JSON.parse(row.label) as { coordinates: [number, number] })
          .coordinates,
      },
      geometry: JSON.parse(row.geometry) as unknown,
    })),
    // A GeoJSON foreign member: readers that do not know it ignore it.
    outside: outside ? (JSON.parse(outside.geometry) as unknown) : null,
  };
}

export async function GET() {
  // Populate the shared cache at request time, not during an offline build.
  await connection();
  return Response.json(await collection(), {
    headers: {
      "content-type": "application/geo+json",
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
