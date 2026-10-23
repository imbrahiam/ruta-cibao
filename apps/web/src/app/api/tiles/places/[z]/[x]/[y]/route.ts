import { cacheLife, cacheTag } from "next/cache";
import {
  parseTileCoordinates,
  placesTile,
  type TileCoordinates,
} from "@/lib/tiles";

/**
 * The citizen map layer, as vector tiles.
 *
 * A route handler rather than an oRPC procedure: the response is a binary tile,
 * not JSON, and MapLibre requests it by URL template.
 *
 * Tiles are cached and tagged. Publishing or moderating a place calls
 * `revalidateTag("places-tiles")`, so a newly approved place appears without
 * anyone waiting out a timer, and nothing is recomputed in between.
 */
export const PLACES_TILES_TAG = "places-tiles";

async function tile(coordinates: TileCoordinates) {
  "use cache";
  cacheTag(PLACES_TILES_TAG);
  cacheLife("hours");

  return placesTile(coordinates);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const { z, x, y } = await context.params;
  const coordinates = parseTileCoordinates(z, x, y);

  // Refused before touching the database: a tile index outside the pyramid is
  // either a bug or someone probing, and neither deserves a query.
  if (!coordinates) {
    return new Response("invalid tile coordinates", { status: 400 });
  }

  const body = await tile(coordinates);

  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/vnd.mapbox-vector-tile",
      // Public data, so a shared cache may hold it; revalidation is driven by
      // the tag above rather than by this window expiring.
      "cache-control":
        "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
