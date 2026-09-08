/**
 * Where the province actually is.
 *
 * A rectangle around Santiago Rodríguez is wrong in both directions at once: it
 * reaches 25 km into Valverde on the east and cuts the western edge of Sabaneta
 * off on the west, so a citizen standing on Dominican ground near the border
 * gets told their point is outside the province. Real polygons fix both, and
 * they answer a second question the rectangle could not — *which* municipality
 * a point is in, which is a fact the geometry knows and the person filling in
 * the form should not have to.
 *
 * The same file is loaded by the browser and read by PostGIS on the server. The
 * client's copy exists so the warning under the crosshair can update while the
 * map is being dragged; the database is still the authority on submit.
 */
export type MunicipalFeature = {
  properties: { id: string; name: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
};

export type MunicipalBoundaries = { features: MunicipalFeature[] };

export type Position = { lng: number; lat: number };

/**
 * Ray casting, with holes.
 *
 * A ring after the first in a polygon is a hole — a lake, an enclave — and a
 * point inside one is outside the polygon. Counting every ring's crossings
 * together handles that for free: an even number of crossings means outside,
 * and a hole always contributes a second pair.
 */
function inRing(point: Position, ring: number[][]): boolean {
  let inside = false;

  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    index++
  ) {
    const current = ring[index];
    const last = ring[previous];
    previous = index;
    if (!current || !last) continue;

    const [x1, y1] = current as [number, number];
    const [x2, y2] = last as [number, number];

    if (
      y1 > point.lat !== y2 > point.lat &&
      point.lng < ((x2 - x1) * (point.lat - y1)) / (y2 - y1) + x1
    ) {
      inside = !inside;
    }
  }

  return inside;
}

function inPolygon(point: Position, rings: number[][][]): boolean {
  const [outer, ...holes] = rings;
  if (!outer || !inRing(point, outer)) return false;
  return !holes.some((hole) => inRing(point, hole));
}

function inFeature(point: Position, feature: MunicipalFeature): boolean {
  return feature.geometry.type === "MultiPolygon"
    ? feature.geometry.coordinates.some((rings) => inPolygon(point, rings))
    : inPolygon(point, feature.geometry.coordinates);
}

/**
 * Which municipality a point belongs to.
 *
 * Three answers, not two, and the third one is the whole reason this function
 * exists in this shape. "Inside" and "outside" are facts about the point;
 * `unknown` is a fact about *us* — the 30 KB of polygons is still in flight, or
 * the request for it failed, or nobody has imported them into this database
 * yet.
 *
 * Collapsing `unknown` into `outside` is what made the crosshair tell people
 * standing in the middle of Sabaneta that they were outside the province, and
 * then refuse to let them submit. The map cannot answer yet is not the same
 * sentence as the map says no, and only one of them is worth blocking somebody
 * over. The database's `ST_Contains` is the authority on submit either way, so
 * being unsure here costs nothing but a round trip.
 */
export type MunicipalityLocation =
  | { state: "inside"; municipality: { id: string; name: string } }
  | { state: "outside"; municipality: null }
  | { state: "unknown"; municipality: null };

export function municipalityAt(
  point: Position,
  boundaries: MunicipalBoundaries | undefined,
): MunicipalityLocation {
  // No polygons is not an empty province. It is no answer.
  if (!boundaries || boundaries.features.length === 0) {
    return { state: "unknown", municipality: null };
  }

  const match = boundaries.features.find((feature) =>
    inFeature(point, feature),
  );

  return match
    ? { state: "inside", municipality: match.properties }
    : { state: "outside", municipality: null };
}
