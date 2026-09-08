/** Road lookup uses the local OSM import; no external request is made per pick. */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roads } from "@/db/schema";

import {
  DEFAULT_STREET_EXTENT,
  nearestOnPath,
  type PathPoint,
  pathLength,
  pathMidpoint,
  type Street,
  windowAround,
} from "./road-geometry";

/** A report cannot mark more than two kilometres of road. */
export const MAX_STREET_METRES = 2_000;

/** How far from the crosshair a road may be and still be "the one you are on". */
const SEARCH_RADIUS_METRES = 45;

/**
 * How far along to gather the rest of a named street.
 *
 * OSM splits a road into a new way wherever something about it changes — a
 * junction, a surface, a speed limit — so "Calle Francisco Bueno" is a dozen
 * ways, not one. Taking only the nearest was why a report covered 191 m of a
 * street somebody could see running for blocks.
 *
 * Bounded rather than unbounded because the name is not unique: every town in
 * the province has a Calle Duarte, and stitching by name alone would join three
 * of them across thirty kilometres.
 */
const STITCH_RADIUS_METRES = 1_500;

export type StreetLookup = {
  candidates: { id: string; name: string | null; distanceMeters: number }[];
  street: Street | null;
  /**
   * Whether there is a road network to look in at all.
   *
   * The difference between this and a null `street` is the difference between
   * "there is no road here" and "we cannot say", and collapsing them is what
   * made the crosshair tell people standing on Calle Ignacio Reyes that no
   * street could be found. One of those is a fact about the place; the other is
   * a fact about the deployment, and only the first is worth showing.
   */
  available: boolean;
};

/**
 * Whether the province's roads have been imported.
 *
 * Cached for a minute rather than asked per lookup: an empty table is a
 * deployment that has not run `bun run db:roads` yet, which is a state that
 * changes once and then never again.
 */
let roadsPresent: { value: boolean; at: number } | undefined;
const PRESENCE_TTL_MS = 60_000;

async function hasRoads(): Promise<boolean> {
  if (roadsPresent && Date.now() - roadsPresent.at < PRESENCE_TTL_MS) {
    return roadsPresent.value;
  }

  const [row] = await db.select({ id: roads.id }).from(roads).limit(1);
  roadsPresent = { value: row !== undefined, at: Date.now() };
  return roadsPresent.value;
}

type GeoJsonLine =
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] };

/** Whichever piece of a stitched street the point actually falls on. */
function componentNearest(
  geometry: GeoJsonLine,
  point: PathPoint,
): PathPoint[] | null {
  const parts =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.coordinates;

  let best: { path: PathPoint[]; distance: number } | null = null;

  for (const part of parts) {
    const path = part.map(([lng, lat]) => ({ lng, lat }));
    if (path.length < 2) continue;

    const nearest = nearestOnPath(path, point);
    if (!nearest) continue;
    if (!best || nearest.distance < best.distance) {
      best = { path, distance: nearest.distance };
    }
  }

  return best?.path ?? null;
}

/** Find nearby centre lines in metres, preserving an explicit way selection. */
export async function streetAt(
  point: PathPoint & { roadId?: string; extentMeters?: number },
): Promise<StreetLookup> {
  if (!(await hasRoads()))
    return { street: null, available: false, candidates: [] };

  const origin = sql`ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)`;

  const candidates = await db
    .select({
      id: roads.id,
      name: roads.name,
      path: roads.path,
      distanceMeters: sql<number>`ST_Distance(${roads.path}::geography, ${origin}::geography)`,
    })
    .from(roads)
    .where(
      sql`${roads.path} && ST_Expand(${origin}, 0.0006) and ST_DWithin(${roads.path}::geography, ${origin}::geography, ${SEARCH_RADIUS_METRES})`,
    )
    .orderBy(
      sql`ST_Distance(${roads.path}::geography, ${origin}::geography)`,
      roads.id,
    )
    .limit(6);

  const options = candidates.map(({ id, name, distanceMeters }) => ({
    id,
    name,
    distanceMeters: Math.round(distanceMeters),
  }));
  const nearest = point.roadId
    ? candidates.find((candidate) => candidate.id === point.roadId)
    : candidates[0];

  if (!nearest) return { street: null, available: true, candidates: options };

  let path = nearest.path.map((node) => ({ lng: node.x, lat: node.y }));

  if (nearest.name) {
    const stitched = await db.execute<{ geometry: string | null }>(sql`
      select ST_AsGeoJSON(ST_LineMerge(ST_Collect(${roads.path}))) as geometry
        from ${roads}
       where ${roads.name} = ${nearest.name}
         and ST_DWithin(${roads.path}::geography, ${origin}::geography, ${STITCH_RADIUS_METRES})
    `);

    const raw = stitched.rows[0]?.geometry;
    if (raw) {
      const geometry = z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("LineString"),
            coordinates: z.array(z.tuple([z.number(), z.number()])),
          }),
          z.object({
            type: z.literal("MultiLineString"),
            coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
          }),
        ])
        .parse(JSON.parse(raw));
      const whole = componentNearest(geometry, pathMidpoint(path));
      if (whole) path = whole;
    }
  }

  // Never shade farther than the citizen confirmed in the preview.
  const extent = Math.min(
    point.extentMeters ?? DEFAULT_STREET_EXTENT,
    MAX_STREET_METRES,
  );
  const trimmed =
    pathLength(path) <= extent ? path : windowAround(path, point, extent);

  return {
    street: {
      roadId: nearest.id,
      distanceMeters: Math.round(nearest.distanceMeters),
      name: nearest.name,
      path: trimmed,
      lengthMeters: Math.round(pathLength(trimmed)),
    },
    available: true,
    candidates: options,
  };
}

/**
 * Every road in view, for the picker to resolve taps and hovers against.
 *
 * The map draws the roads; this is the geometry behind them, so a tap a
 * thumb's width from a centre line still finds it without asking the server.
 * Cheap now that the network is local — this is one bounding-box query against
 * a GiST index, which is the same shape of question the map tiles already ask
 * on every pan.
 *
 * Simplified on the way out. At picking zoom a road's exact vertices are far
 * finer than a screen pixel, and the difference between the simplified line and
 * the real one is invisible where the shape is only there to be aimed at. The
 * street a report actually covers is resolved separately by `streetAt`, from
 * the full geometry.
 */
const CANDIDATE_SIMPLIFY_DEGREES = 0.00002;

export type RoadCandidate = {
  id: string;
  name: string | null;
  path: PathPoint[];
};

export async function roadsInView(
  bounds: { west: number; south: number; east: number; north: number },
  limit: number,
): Promise<RoadCandidate[]> {
  if (!(await hasRoads())) return [];

  const envelope = sql`ST_MakeEnvelope(${bounds.west}, ${bounds.south}, ${bounds.east}, ${bounds.north}, 4326)`;

  const rows = await db
    .select({
      id: roads.id,
      name: roads.name,
      // `ST_Simplify` can collapse a short way to null; the filter below drops
      // those rather than shipping an empty line to the map.
      path: sql<
        string | null
      >`ST_AsGeoJSON(ST_Simplify(${roads.path}, ${CANDIDATE_SIMPLIFY_DEGREES}))`,
    })
    .from(roads)
    // `&&` is the bounding-box overlap the GiST index answers directly.
    .where(sql`${roads.path} && ${envelope}`)
    .orderBy(sql`${roads.path} <-> ST_Centroid(${envelope})`, roads.id)
    .limit(limit);

  const candidates: RoadCandidate[] = [];

  for (const row of rows) {
    if (!row.path) continue;
    const geometry = JSON.parse(row.path) as {
      coordinates?: [number, number][];
    };
    const path = (geometry.coordinates ?? []).map(([lng, lat]) => ({
      lng,
      lat,
    }));
    if (path.length > 1) candidates.push({ id: row.id, name: row.name, path });
  }

  return candidates;
}
