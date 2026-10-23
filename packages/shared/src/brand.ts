/**
 * The Ruta Cibao mark — a winding road that ends at a pin — as plain geometry
 * on a 1024 × 1024 canvas, so the app icon generator and the in-app logo draw
 * exactly the same shape.
 */
export const BRAND_COLORS = {
  pine: "#183F32",
  pineLight: "#1F6B52",
  paper: "#F3F2EE",
} as const;

export const MARK = {
  viewBox: 1024,
  road: "M 300 800 C 300 650, 560 690, 560 560 C 560 470, 660 500, 660 440",
  roadWidth: 80,
  laneWidth: 12,
  laneDash: [32, 30] as const,
  start: { cx: 300, cy: 800, r: 54, inner: 21 },
  pin: "M 660 440 c -66 -62 -110 -118 -110 -178 a 110 110 0 1 1 220 0 c 0 60 -44 116 -110 178 z",
  pinDot: { cx: 660, cy: 262, r: 42 },
  /** The mark's own bounds, for cropping it tight in UI. */
  bounds: { x: 246, y: 152, width: 524, height: 702 },
} as const;
