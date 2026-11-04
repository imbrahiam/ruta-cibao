export type ViewTransform = { scale: number; x: number; y: number };

export type ViewBounds = {
  stageWidth: number;
  stageHeight: number;
  contentWidth: number;
  contentHeight: number;
};

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
export const IDENTITY: ViewTransform = { scale: MIN_SCALE, x: 0, y: 0 };

export function clampTransform(
  t: ViewTransform,
  bounds: ViewBounds,
): ViewTransform {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, t.scale));
  const maxX = Math.max(
    0,
    (bounds.contentWidth * scale - bounds.stageWidth) / 2,
  );
  const maxY = Math.max(
    0,
    (bounds.contentHeight * scale - bounds.stageHeight) / 2,
  );
  return {
    scale,
    x: Math.max(-maxX, Math.min(maxX, t.x)),
    y: Math.max(-maxY, Math.min(maxY, t.y)),
  };
}

export function zoomAt(
  t: ViewTransform,
  nextScale: number,
  point: { x: number; y: number },
  bounds: ViewBounds,
): ViewTransform {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
  const ratio = scale / t.scale;
  return clampTransform(
    {
      scale,
      x: point.x - (point.x - t.x) * ratio,
      y: point.y - (point.y - t.y) * ratio,
    },
    bounds,
  );
}

export function panBy(
  t: ViewTransform,
  dx: number,
  dy: number,
  bounds: ViewBounds,
): ViewTransform {
  return clampTransform({ ...t, x: t.x + dx, y: t.y + dy }, bounds);
}
