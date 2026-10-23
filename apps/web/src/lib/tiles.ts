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

/**
 * Below this zoom the tile carries counted clusters instead of individual
 * points.
 *
 * At province scale a hundred markers land on top of each other and read as one
 * illegible smudge, and the browser still pays for every one. MapLibre cannot
 * cluster a vector source — only GeoJSON — so the aggregation happens in the
 * query, which is where the data already is.
 */
export const CLUSTER_MAX_ZOOM = 12;

/** Cells across a tile. Sixteen keeps clusters roughly a thumb apart. */
const CLUSTER_GRID_DIVISIONS = 16;

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
/**
 * Individual places, one feature each.
 *
 * The bounding-box filter compares against `location` in its own SRID rather
 * than transforming the column, because transforming per row makes the GIST
 * index useless and turns every tile into a full table scan. Only the surviving
 * rows are reprojected, and only their geometry.
 */
async function pointsTile({
  z,
  x,
  y,
}: TileCoordinates): Promise<Buffer | null> {
  const result = await db.execute<{ tile: Buffer | null }>(sql`
    with bounds as (
      select
        ST_TileEnvelope(${z}, ${x}, ${y}) as mercator,
        ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) as geographic
    ),
    tile_rows as (
      select
        ST_AsMVTGeom(ST_Transform(places.location, 3857), bounds.mercator, ${EXTENT}, ${BUFFER}, true) as geom,
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

  return result.rows[0]?.tile ?? null;
}

/**
 * Counted clusters, one feature per grid cell.
 *
 * The grid is sized in tile units, so a cell covers the same amount of screen
 * at every zoom instead of shrinking as you go in. Each cluster is placed at
 * the centroid of its members rather than the cell centre, so it sits over the
 * places it stands for instead of drifting to a corner.
 */
async function clustersTile({
  z,
  x,
  y,
}: TileCoordinates): Promise<Buffer | null> {
  const result = await db.execute<{ tile: Buffer | null }>(sql`
    with bounds as (
      select
        ST_TileEnvelope(${z}, ${x}, ${y}) as mercator,
        ST_Transform(ST_TileEnvelope(${z}, ${x}, ${y}), 4326) as geographic
    ),
    snapped as (
      select
        ST_Transform(places.location, 3857) as mercator_point,
        categories.color,
        categories.icon,
        places.id,
        places.slug,
        places.name,
        places.category_id as category,
        ST_SnapToGrid(
          ST_Transform(places.location, 3857),
          (ST_XMax(bounds.mercator) - ST_XMin(bounds.mercator)) / ${CLUSTER_GRID_DIVISIONS}
        ) as cell
      from places
      join categories on categories.id = places.category_id
      cross join bounds
      where places.status = 'published'
        and places.location && bounds.geographic
    ),
    category_counts as (
      select cell, category, count(*)::int as count
      from snapped
      group by cell, category
    ),
    cell_counts as (
      select cell, jsonb_object_agg('count:' || category, count) as category_counts
      from category_counts
      group by cell
    ),
    tile_rows as (
      select
        ST_AsMVTGeom(
          ST_Centroid(ST_Collect(snapped.mercator_point)),
          bounds.mercator,
          ${EXTENT},
          ${BUFFER},
          true
        ) as geom,
        count(*)::int as count,
        mode() within group (order by snapped.color) as color,
        -- A cell of one is drawn as that place's own pin and opens on a tap,
        -- so it carries what a point tile would. Null on every larger cell.
        case when count(*) = 1 then min(snapped.icon::text) end as icon,
        case when count(*) = 1 then min(snapped.id::text) end as id,
        case when count(*) = 1 then min(snapped.slug) end as slug,
        case when count(*) = 1 then min(snapped.name) end as name,
        case when count(*) = 1 then min(snapped.category::text) end as category,
        cell_counts.category_counts
      from snapped
      join cell_counts on cell_counts.cell = snapped.cell
      cross join bounds
      group by snapped.cell, bounds.mercator, cell_counts.category_counts
    )
    select ST_AsMVT(tile_rows, 'clusters', ${EXTENT}, 'geom') as tile from tile_rows
  `);

  return result.rows[0]?.tile ?? null;
}

/**
 * The tile for these coordinates.
 *
 * Which shape to build is decided here rather than in the query. Passing the
 * zoom into SQL as a comparison looked equivalent and was not: the driver sends
 * it as an untyped parameter, Postgres compares it as text, and `'9' > '12'` is
 * true. The province zoomed out rendered individual markers — the exact smudge
 * clustering exists to prevent — while zoom 11 and 12 clustered correctly, so
 * it looked like it worked.
 */
export async function placesTile(
  coordinates: TileCoordinates,
): Promise<Buffer> {
  const tile =
    coordinates.z <= CLUSTER_MAX_ZOOM
      ? await clustersTile(coordinates)
      : await pointsTile(coordinates);

  // An empty tile is a normal answer — most of the province is empty at high
  // zoom — and MapLibre reads zero bytes as "nothing here" without complaint.
  return tile ?? Buffer.alloc(0);
}
