/**
 * A route's traced line as an SVG polyline in a `width` x `height` box.
 *
 * Longitude is scaled by cos(latitude) so the shape keeps its true proportions
 * at this latitude; no map tiles are involved, so nothing is fetched.
 */
export function pathPoints(
  path: readonly { lng: number; lat: number }[],
  width: number,
  height: number,
  padding = 16,
): { points: string; start: [number, number]; end: [number, number] } | null {
  const first = path[0];
  const last = path.at(-1);
  if (!first || !last || path.length < 2) return null;

  const lngScale = Math.cos((first.lat * Math.PI) / 180);
  const xs = path.map((point) => point.lng * lngScale);
  const ys = path.map((point) => point.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const scale = Math.min(
    (width - padding * 2) / spanX,
    (height - padding * 2) / spanY,
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const project = (index: number): [number, number] => [
    Math.round(((xs[index] ?? 0) - minX) * scale + offsetX),
    Math.round(height - (((ys[index] ?? 0) - minY) * scale + offsetY)),
  ];
  const projected = path.map((_, index) => project(index));
  return {
    points: projected.map(([x, y]) => `${x},${y}`).join(" "),
    start: projected[0] as [number, number],
    end: projected.at(-1) as [number, number],
  };
}
