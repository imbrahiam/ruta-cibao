import { describe, expect, test } from "bun:test";
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { project, territoryFrame } from "@/modules/landing/frame";

describe("territory frame", () => {
  const frame = territoryFrame(PROVINCE_BOUNDS, 400);

  test("spans the requested width and keeps the province's proportions", () => {
    const [west, south, east, north] = PROVINCE_BOUNDS;
    expect(project(frame, west, north)).toEqual({ x: 0, y: 0 });
    expect(project(frame, east, south).x).toBeCloseTo(400, 0);
    // About as tall as it is wide: 0.40° of latitude against 0.44° of
    // longitude shrunk by cos(19.36°).
    expect(frame.height).toBeGreaterThan(370);
    expect(frame.height).toBeLessThan(395);
  });

  test("puts north at the top and east on the right", () => {
    const sabaneta = project(frame, -71.3178, 19.3625);
    const moncion = project(frame, -71.1639, 19.384);
    expect(moncion.x).toBeGreaterThan(sabaneta.x);
    expect(moncion.y).toBeLessThan(sabaneta.y);
  });
});
