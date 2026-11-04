import type { PathPoint } from "@ruta/shared/road-geometry";

/**
 * Turns the vertices a provider answers with into one clean centreline.
 *
 * The Roads and Routes APIs answer with road geometry, but not with a drawing:
 * the snapped points of a stretch interleave the original samples with the
 * road's own vertices, which leaves metre-long steps beside the line; a walking
 * route reaches an off-road waypoint by going out a side street and coming back
 * down the same one, a spur that the highlight would draw twice. The three steps
 * here (merge near points, collapse spurs, round corners) leave a line that
 * stays on the road it came from and follows it smoothly.
 *
 * All arithmetic is in a local flat plane in metres around the path, which is
 * exact enough for a few kilometres.
 */

type XY = { x: number; y: number };

const EARTH_RADIUS = 6_371_000;
const RAD = Math.PI / 180;

/** Vertices closer than this are one: the provider's own interleaved samples. */
const MERGE_METRES = 3;

/** A path that comes back within this many metres of where it went is a spur. */
const SPUR_TOLERANCE_METRES = 5;

/** A turn this sharp (degrees) is a reversal: the apex of an out-and-back. */
const REVERSAL_DEGREES = 150;

/**
 * How far from a vertex a corner is rounded. Bounded so the line never leaves
 * the street: at a right angle it moves 0.35 × this off the corner.
 */
const ROUND_METRES = 4;

/** Turns gentler than this (degrees) are left as they are. */
const STRAIGHT_DEGREES = 2;

/** Arc steps of a rounded corner: one per this many degrees of turn. */
const STEP_DEGREES = 10;

function toPlane(path: PathPoint[]): {
  points: XY[];
  unproject: (p: XY) => PathPoint;
} {
  const first = path[0];
  const lat0 = first?.lat ?? 0;
  const lng0 = first?.lng ?? 0;
  const scaleX = Math.cos(lat0 * RAD) * EARTH_RADIUS * RAD;
  const scaleY = EARTH_RADIUS * RAD;
  return {
    points: path.map((point) => ({
      x: (point.lng - lng0) * scaleX,
      y: (point.lat - lat0) * scaleY,
    })),
    unproject: (p) => ({ lng: lng0 + p.x / scaleX, lat: lat0 + p.y / scaleY }),
  };
}

const dist = (a: XY, b: XY) => Math.hypot(b.x - a.x, b.y - a.y);

/** Points closer than `MERGE_METRES` collapse; the first and last always stay. */
function merge(points: XY[]): XY[] {
  const kept: XY[] = [];
  for (const point of points) {
    const last = kept[kept.length - 1];
    if (!last || dist(last, point) >= MERGE_METRES) kept.push(point);
  }
  const end = points[points.length - 1];
  if (end && kept.length > 1 && kept[kept.length - 1] !== end) {
    // The end is where the stretch stops: it replaces a neighbour, not joins it.
    kept[kept.length - 1] = end;
  }
  return kept;
}

/** Where on `points[0..to]` the point `p` is closest. */
function nearestOnLeg(
  points: XY[],
  to: number,
  p: XY,
): { segment: number; point: XY; distance: number } | null {
  let best: { segment: number; point: XY; distance: number } | null = null;
  for (let index = 0; index < to; index += 1) {
    const a = points[index];
    const b = points[index + 1];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t =
      length === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length),
          );
    const point = { x: a.x + t * dx, y: a.y + t * dy };
    const distance = dist(point, p);
    if (!best || distance < best.distance)
      best = { segment: index, point, distance };
  }
  return best;
}

/** Degrees turned at `b` going a → b → c, 0 when straight, 180 when reversed. */
function turnAt(a: XY, b: XY, c: XY): number {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const norm = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (norm === 0) return 0;
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / norm));
  return Math.acos(cos) / RAD;
}

/**
 * Removes out-and-back detours: where the path reverses and then retraces what
 * it just walked, both legs go and the path carries on from where the detour
 * began. A path that ends by retracing itself back to its start is left alone.
 */
function collapseSpurs(input: XY[]): XY[] {
  let points = input;
  // Each pass removes one spur; a route has a handful at most.
  for (let pass = 0; pass < 32; pass += 1) {
    let collapsed: XY[] | null = null;
    for (let apex = 1; apex < points.length - 1 && !collapsed; apex += 1) {
      const before = points[apex - 1];
      const here = points[apex];
      const after = points[apex + 1];
      if (!before || !here || !after) continue;
      if (turnAt(before, here, after) < REVERSAL_DEGREES) continue;

      // The last point after the apex still lying on the way out.
      let back = -1;
      let rejoin: { segment: number; point: XY } | null = null;
      for (let index = apex + 1; index < points.length; index += 1) {
        const point = points[index];
        if (!point) break;
        const near = nearestOnLeg(points, apex, point);
        if (!near || near.distance > SPUR_TOLERANCE_METRES) break;
        back = index;
        rejoin = near;
      }
      // Retraced to the very end: that is the route's own way home.
      if (back < 0 || back >= points.length - 1 || !rejoin) continue;
      collapsed = [
        ...points.slice(0, rejoin.segment + 1),
        rejoin.point,
        ...points.slice(back + 1),
      ];
    }
    if (!collapsed) break;
    points = collapsed;
  }
  return points;
}

/**
 * Rounds every corner with a small arc (a quadratic curve through the corner),
 * at most `ROUND_METRES` from it and never more than a third of a segment, so
 * the line follows a bend instead of kinking and stays inside the street.
 */
function roundCorners(points: XY[]): XY[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 3) return points;
  const result: XY[] = [first];
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const c = points[index + 1];
    if (!a || !b || !c) continue;
    const turn = turnAt(a, b, c);
    const lengthIn = dist(a, b);
    const lengthOut = dist(b, c);
    if (turn < STRAIGHT_DEGREES || lengthIn === 0 || lengthOut === 0) {
      result.push(b);
      continue;
    }
    const cutIn = Math.min(ROUND_METRES, lengthIn / 3);
    const cutOut = Math.min(ROUND_METRES, lengthOut / 3);
    const entry = {
      x: b.x + ((a.x - b.x) / lengthIn) * cutIn,
      y: b.y + ((a.y - b.y) / lengthIn) * cutIn,
    };
    const exit = {
      x: b.x + ((c.x - b.x) / lengthOut) * cutOut,
      y: b.y + ((c.y - b.y) / lengthOut) * cutOut,
    };
    const steps = Math.max(2, Math.ceil(turn / STEP_DEGREES));
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      result.push({
        x: u * u * entry.x + 2 * u * t * b.x + t * t * exit.x,
        y: u * u * entry.y + 2 * u * t * b.y + t * t * exit.y,
      });
    }
  }
  result.push(last);
  return result;
}

/**
 * The same road as one smooth centreline: near points merged, spurs collapsed,
 * corners rounded. The ends do not move.
 */
export function cleanCentreline(path: PathPoint[]): PathPoint[] {
  if (path.length < 2) return path;
  const { points, unproject } = toPlane(path);
  const clean = roundCorners(collapseSpurs(merge(points)));
  return clean.map(unproject);
}
