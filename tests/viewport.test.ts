import { describe, expect, test } from "bun:test";
import {
  CROSSHAIR_FRACTION,
  crosshairOffsetPx,
  metresPerPixel,
  offsetCenter,
  pointAtHeightFraction,
} from "@/lib/map/viewport";

const sabaneta = {
  lng: -71.3435,
  lat: 19.4775,
  zoom: 16,
  bounds: { west: -71.35, east: -71.337, south: 19.47, north: 19.485 },
};

describe("pointAtHeightFraction", () => {
  test("half way down is the centre", () => {
    const point = pointAtHeightFraction(sabaneta, 0.5);
    expect(point.lng).toBe(sabaneta.lng);
    expect(point.lat).toBeCloseTo(sabaneta.lat, 3);
  });

  test("the crosshair is north of the centre", () => {
    const point = pointAtHeightFraction(sabaneta, CROSSHAIR_FRACTION);
    expect(point.lat).toBeGreaterThan(sabaneta.lat);
    expect(point.lat).toBeLessThan(sabaneta.bounds.north);
  });

  test("the edges map onto the bounds", () => {
    expect(pointAtHeightFraction(sabaneta, 0).lat).toBeCloseTo(
      sabaneta.bounds.north,
      9,
    );
    expect(pointAtHeightFraction(sabaneta, 1).lat).toBeCloseTo(
      sabaneta.bounds.south,
      9,
    );
  });

  test("falls back to the centre before the map has reported bounds", () => {
    const { bounds: _bounds, ...first } = sabaneta;
    expect(pointAtHeightFraction(first, CROSSHAIR_FRACTION)).toEqual({
      lng: first.lng,
      lat: first.lat,
    });
  });
});

describe("crosshairOffsetPx", () => {
  test("moves the target up by the crosshair's distance from centre", () => {
    expect(crosshairOffsetPx(800)).toEqual({ x: 0, y: -80 });
    expect(crosshairOffsetPx(0)).toEqual({ x: 0, y: 0 });
  });
});

describe("metresPerPixel", () => {
  test("halves with every zoom level", () => {
    const z15 = metresPerPixel(19.5, 15);
    const z16 = metresPerPixel(19.5, 16);
    expect(z15 / z16).toBeCloseTo(2, 6);
    // A little over two metres at street zoom in the province.
    expect(z16).toBeGreaterThan(2);
    expect(z16).toBeLessThan(2.5);
  });
});

describe("offsetCenter", () => {
  const target = { lng: sabaneta.lng, lat: sabaneta.lat };

  /** Where `target` lands on screen, in pixels from the centre of the map. */
  function screenOffset(
    centre: { lng: number; lat: number },
    zoom: number,
  ): { x: number; y: number } {
    const metres = metresPerPixel(target.lat, zoom);
    const rad = Math.PI / 180;
    return {
      x:
        ((target.lng - centre.lng) *
          rad *
          6378137 *
          Math.cos(target.lat * rad)) /
        metres,
      y: (-(target.lat - centre.lat) * rad * 6378137) / metres,
    };
  }

  test("puts the target where the offset asks, in pixels", () => {
    // The phone sheet: the pin belongs in the strip above it.
    const phone = offsetCenter(target, 16, { x: 0, y: -162 });
    expect(screenOffset(phone, 16).x).toBeCloseTo(0, 1);
    expect(screenOffset(phone, 16).y).toBeCloseTo(-162, 0);

    // The desktop panel: half its width to the left, a little below centre.
    const desktop = offsetCenter(target, 16, { x: -214, y: 54 });
    expect(screenOffset(desktop, 16).x).toBeCloseTo(-214, 0);
    expect(screenOffset(desktop, 16).y).toBeCloseTo(54, 0);
  });

  test("displaces less ground the closer the map is", () => {
    const near = offsetCenter(target, 16, { x: 0, y: -200 });
    const far = offsetCenter(target, 8, { x: 0, y: -200 });
    // Eight zoom levels is 256 times the ground per pixel — the whole reason
    // the centre is solved for at the target zoom rather than nudged
    // afterwards. Not exactly 256: two hundred pixels at zoom 8 spans seven
    // degrees of latitude, over which Mercator's scale itself changes.
    const ratio = (far.lat - target.lat) / (near.lat - target.lat);
    expect(ratio).toBeGreaterThan(250);
    expect(ratio).toBeLessThan(262);
  });

  test("leaves the centre alone without an offset", () => {
    expect(offsetCenter(target, 16, { x: 0, y: 0 }).lng).toBeCloseTo(
      target.lng,
      9,
    );
    expect(offsetCenter(target, 16, { x: 0, y: 0 }).lat).toBeCloseTo(
      target.lat,
      9,
    );
  });
});
