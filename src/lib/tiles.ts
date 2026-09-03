/**
 * Vector tiles built by Postgres.
 *
 * `ST_AsMVT` turns a query result into a Mapbox Vector Tile inside the
 * database, so the map receives one compact binary per tile instead of a JSON
 * array the browser has to parse and turn into thousands of DOM markers. It is
 * also what makes the layer stay smooth as the province's data grows: work
 * scales with what is on screen, not with what exists.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Tiles are square; 4096 is the conventional extent and what MapLibre expects. */
const EXTENT = 4096;
/** A buffer, so a marker sitting on a tile edge is not clipped in half. */
const BUFFER = 64;

export const MAX_ZOOM = 20;

export type TileCoordinates = { z: number; x: number; y: number };

/** Rejects coordinates that cannot exist, before they reach the database. */
export function parseTileCoordinates(
  z: string,
  x: string,
  y: string,
): TileCoordinates | null {
  const zoom = Number.parseInt(z, 10);
  const column = Number.parseInt(x, 10);
  const row = Number.parseInt(y, 10);

  if (!Number.isInteger(zoom) || zoom < 0 || zoom > MAX_ZOOM) return null;

  const limit = 2 ** zoom;
  if (!Number.isInteger(column) || column < 0 || column >= limit) return null;
  if (!Number.isInteger(row) || row < 0 || row >= limit) return null;

  return { z: zoom, x: column, y: row };
}

/**
 * The published places inside one tile.
 *
 * The bounding-box filter compares against `location` in its own SRID rather
 * than transforming the column, because transforming it per row would make the
 * GIST index useless — the whole table would be scanned for every tile. Only
 * the rows that survive are reprojected, and only for their geometry.
 *
 * Properties are kept small on purpose: a tile carries what the map needs to
 * draw and label a marker. Everything else is fetched when someone taps one.
 */
export async function placesTile({
  z,
  x,
  y,
}: TileCoordinates): Promise<Buffer> {
  const result = await db.execute<{ tile: Buffer | null }>(sql`
    with bounds as (
      select
        ST_TileEnvelope(${z}, ${x}, ${y}) as mercator,
        ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) as geographic
    ),
    tile_rows as (
      select
        ST_AsMVTGeom(
          ST_Transform(places.location, 3857),
          bounds.mercator,
          ${EXTENT},
          ${BUFFER},
          true
        ) as geom,
        places.id::text as id,
        places.slug,
        places.name,
        places.category_id as category,
        places.municipality_id as municipality,
        categories.color,
        categories.icon
      from places
      join categories on categories.id = places.category_id
      cross join bounds
      where places.status = 'published'
        and places.location && bounds.geographic
    )
    select ST_AsMVT(tile_rows, 'places', ${EXTENT}, 'geom') as tile from tile_rows
  `);

  const tile = result.rows[0]?.tile;

  // An empty tile is a normal answer — most of the province is empty at high
  // zoom — and MapLibre reads zero bytes as "nothing here" without complaint.
  return tile ?? Buffer.alloc(0);
}
