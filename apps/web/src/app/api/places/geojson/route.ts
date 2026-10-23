import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { db } from "@/db";
import { categories, places } from "@/db/schema";

/**
 * Every published place, as GeoJSON.
 *
 * Leaflet reads GeoJSON natively, and at this scale that is the right trade: a
 * province with a few hundred points is a single small response, cached and
 * tagged, rather than a pyramid of vector tiles. The tile endpoint still exists
 * and is still the answer if this ever outgrows one payload.
 */
export const PLACES_GEOJSON_TAG = "places-geojson";

async function collection() {
  "use cache";
  cacheTag(PLACES_GEOJSON_TAG);
  cacheLife("hours");

  const rows = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      location: places.location,
      categoryId: places.categoryId,
      municipalityId: places.municipalityId,
      color: categories.color,
      icon: categories.icon,
      categoryName: categories.name,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .where(eq(places.status, "published"));

  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      id: row.id,
      geometry: {
        type: "Point" as const,
        coordinates: [row.location.x, row.location.y],
      },
      properties: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        category: row.categoryId,
        categoryName: row.categoryName,
        municipality: row.municipalityId,
        color: row.color,
        icon: row.icon,
      },
    })),
  };
}

export async function GET() {
  // Keep database access out of the build while retaining the tagged cache.
  await connection();
  return Response.json(await collection(), {
    headers: {
      "cache-control":
        "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
