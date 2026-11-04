import { describe, expect, test } from "bun:test";
import {
  clampTransform,
  IDENTITY,
  panBy,
  zoomAt,
} from "@/components/admin/media-viewer/viewer-transform";

const bounds = {
  stageWidth: 800,
  stageHeight: 600,
  contentWidth: 800,
  contentHeight: 600,
};

describe("media viewer transforms", () => {
  test("keeps the content point under the cursor while zooming", () => {
    const start = { scale: 2, x: 30, y: -20 };
    const point = { x: 120, y: 70 };
    const contentPoint = {
      x: (point.x - start.x) / start.scale,
      y: (point.y - start.y) / start.scale,
    };
    const next = zoomAt(start, 3, point, bounds);
    expect(contentPoint.x * next.scale + next.x).toBeCloseTo(point.x);
    expect(contentPoint.y * next.scale + next.y).toBeCloseTo(point.y);
  });

  test("clamps scale at 1 and 6", () => {
    expect(clampTransform({ scale: -3, x: 0, y: 0 }, bounds).scale).toBe(1);
    expect(clampTransform({ scale: 20, x: 0, y: 0 }, bounds).scale).toBe(6);
    expect(zoomAt(IDENTITY, 20, { x: 0, y: 0 }, bounds).scale).toBe(6);
    expect(zoomAt(IDENTITY, -3, { x: 0, y: 0 }, bounds).scale).toBe(1);
  });

  test("recenters when zooming back to the fitted image", () => {
    expect(
      zoomAt({ scale: 3, x: 150, y: -80 }, 1, { x: 90, y: 60 }, bounds),
    ).toEqual(IDENTITY);
  });

  test("does not pan beyond the scaled content edges", () => {
    const zoomed = { scale: 2, x: 0, y: 0 };
    expect(panBy(zoomed, 1000, -1000, bounds)).toEqual({
      scale: 2,
      x: 400,
      y: -300,
    });
    expect(panBy(zoomed, -1000, 1000, bounds)).toEqual({
      scale: 2,
      x: -400,
      y: 300,
    });
  });

  test("centers an axis whose scaled content is smaller than the stage", () => {
    expect(
      panBy({ scale: 2, x: 0, y: 0 }, 500, 500, {
        ...bounds,
        contentWidth: 200,
      }),
    ).toEqual({ scale: 2, x: 0, y: 300 });
    expect(
      panBy({ scale: 2, x: 0, y: 0 }, 500, 500, {
        ...bounds,
        contentHeight: 100,
      }),
    ).toEqual({ scale: 2, x: 400, y: 0 });
  });
});
