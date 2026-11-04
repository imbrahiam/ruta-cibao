import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { readMunicipalBoundaries } from "@/modules/offline/snapshot";

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
 * Boundaries: OpenStreetMap administrative relations (ODbL 1.0), matching the
 * Protomaps basemap. Imported by `scripts/data/import-boundaries.ts`.
 */
export const MUNICIPAL_BOUNDARIES_TAG = "municipal-boundaries";

async function collection() {
  "use cache";
  cacheTag(MUNICIPAL_BOUNDARIES_TAG);
  // Administrative boundaries are redrawn by law, not by traffic.
  cacheLife("days");

  return readMunicipalBoundaries();
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
