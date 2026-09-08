import { describe, expect, test } from "bun:test";
import {
  alertPin,
  markerPin,
  markerSize,
  PIN_GEOMETRY,
  readableOn,
} from "@/lib/map/marker-pin";

/**
 * The pin is an SVG data URI, so nothing about it fails loudly — a broken one
 * renders as a missing image on a map nobody is inspecting. These check the
 * parts that would be silently wrong.
 */
describe("markerPin", () => {
  test("carries the category's colour and an icon", () => {
    const uri = decodeURIComponent(markerPin("#16a34a", "trees", false));

    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(uri).toContain("#16a34a");
    // The lucide icon is rendered in, not referenced.
    expect(uri).toContain("<path");
    expect(markerSize(false)).toEqual({
      width: PIN_GEOMETRY.width,
      height: PIN_GEOMETRY.height,
    });
  });

  test("an unknown icon still produces a pin", () => {
    expect(markerPin("#000000", "no-such-icon", false)).toContain(
      "data:image/svg+xml",
    );
  });

  test("the selected pin is larger", () => {
    expect(markerSize(true).height).toBeGreaterThan(markerSize(false).height);
  });

  test("the same inputs return the same string, so it is cacheable", () => {
    expect(markerPin("#dc2626", "cross", false)).toBe(
      markerPin("#dc2626", "cross", false),
    );
  });

  test("different categories produce different pins", () => {
    expect(markerPin("#dc2626", "cross", false)).not.toBe(
      markerPin("#16a34a", "trees", false),
    );
  });
});

/**
 * The silhouette is one path, and the reason it reads as one object is that the
 * straight sides meet the disc at a tangent. Drawn by eye that is nearly right
 * and visibly wrong at marker size, so the geometry is derived — and these
 * assert the derivation rather than the numbers it happened to produce.
 */
describe("the pin silhouette", () => {
  const { centre, radius, silhouette } = PIN_GEOMETRY;

  /**
   * Parsed by command rather than by scanning for number pairs — an arc's
   * radii and flags are numbers too, and reading them as coordinates is how a
   * test like this quietly measures the wrong thing.
   */
  const N = "([\\d.]+)";
  const parsed = silhouette.match(
    new RegExp(
      `^M${N} ${N} L${N} ${N} A[\\d.]+ [\\d.]+ \\d+ \\d+ \\d+ ${N} ${N} Z$`,
    ),
  );

  const at = (index: number) => ({
    x: Number(parsed?.[index]),
    y: Number(parsed?.[index + 1]),
  });
  const tip = at(1);
  const left = at(3);
  const right = at(5);

  test("is one move, two lines and one arc — a single closed shape", () => {
    // Two moves would be two shapes, which is the seam this replaced.
    expect(parsed).not.toBeNull();
  });

  test("the sides touch the disc rather than crossing it", () => {
    for (const point of [left, right]) {
      const distance = Math.hypot(point.x - centre.x, point.y - centre.y);
      expect(Math.abs(distance - radius)).toBeLessThan(0.01);
    }
  });

  test("the tip sits directly below the centre, clear of the disc", () => {
    expect(tip.x).toBe(centre.x);
    expect(tip.y).toBeGreaterThan(centre.y + radius);
  });

  test("the tail is a nub, not a second shape", () => {
    // What hangs below the disc is a fraction of its radius. Much more and the
    // sides start high on the disc and the pin reads as a lozenge; this keeps
    // it a badge that happens to point at something.
    const overhang = tip.y - (centre.y + radius);
    expect(overhang).toBeLessThan(radius * 0.45);
    // ...and still enough to say which coordinate is meant.
    expect(overhang).toBeGreaterThan(radius * 0.2);
  });

  test("the marker is drawn smaller than the box it is designed in", () => {
    const [, , boxWidth] = PIN_GEOMETRY.viewBox.split(" ").map(Number);
    expect(PIN_GEOMETRY.width).toBeLessThan(boxWidth ?? 0);
  });

  test("the two touch points are a mirrored pair", () => {
    expect(left.y).toBe(right.y);
    expect(left.x + right.x).toBeCloseTo(centre.x * 2, 3);
  });

  test("the sides are tangent, so there is no corner at the shoulder", () => {
    // Tangency means the radius to the touch point is perpendicular to the
    // side, which is the whole reason the shape reads as one object.
    //
    // Compared as the cosine of the angle rather than as a raw dot product:
    // the path data is rounded to three decimals, so an unnormalised product
    // carries the magnitudes of two ~20-unit vectors and looks far larger than
    // the 0.0015° of skew it actually represents.
    const radial = { x: left.x - centre.x, y: left.y - centre.y };
    const side = { x: left.x - tip.x, y: left.y - tip.y };

    const cosine =
      (radial.x * side.x + radial.y * side.y) /
      (Math.hypot(radial.x, radial.y) * Math.hypot(side.x, side.y));

    expect(cosine).toBeCloseTo(0, 3);
  });
});

/**
 * Category colours are rows an official edits, so the icon's ink cannot be a
 * constant. White on `#eab308` is under 2:1 — the glyph that says *which*
 * category this is was the part that disappeared.
 */
describe("readableOn", () => {
  test("white on the dark and saturated colours", () => {
    for (const color of ["#16a34a", "#dc2626", "#2563eb", "#7c3aed"]) {
      expect(readableOn(color)).toBe("#ffffff");
    }
  });

  test("dark ink on the pale ones", () => {
    for (const color of ["#eab308", "#fde047", "#ffffff"]) {
      expect(readableOn(color)).toBe("#1c1917");
    }
  });

  test("shorthand hex is read the same as the long form", () => {
    expect(readableOn("#fff")).toBe(readableOn("#ffffff"));
  });

  test("the pin actually uses it", () => {
    expect(
      decodeURIComponent(markerPin("#eab308", "lightbulb", false)),
    ).toContain('stroke="#1c1917"');
  });
});

describe("alertPin", () => {
  test("is not shaped like a place pin", () => {
    const uri = decodeURIComponent(alertPin("#dc2626", "octagon-x", false));

    // A hazard is an event, not somewhere you can go.
    expect(uri).toContain("<rect");
    expect(uri).toContain("rotate(45 20 20)");
  });

  test("shares the pin's rim, so the two read as one family", () => {
    expect(
      decodeURIComponent(alertPin("#dc2626", "octagon-x", false)),
    ).toContain(`stroke-width="${PIN_GEOMETRY.rim.width}"`);
  });
});
