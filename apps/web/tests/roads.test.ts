import { describe, expect, test } from "bun:test";
import {
  distanceMetres,
  nearestOnPath,
  nearestRoad,
  pathLength,
  pathMidpoint,
  windowAround,
} from "@ruta/shared/road-geometry";

/**
 * A stretch is stored as a line and described to the reader as a number of
 * metres, so these two functions decide both what the map draws and what the
 * drawer claims. Neither fails loudly when it is wrong — a length that is out
 * by a third still renders.
 *
 * The fixture is a real three-point stretch in Sabaneta, and its expected
 * length is not a number this file made up: PostGIS measures the same line at
 * 250 m with `ST_Length(path::geography)`. That is the cross-check that matters,
 * because the whole point of computing it here rather than in the database is
 * to avoid a round trip — which is only worth doing if the two agree.
 */
const START = { lng: -71.3506, lat: 19.4833 };
const BEND = { lng: -71.3498, lat: 19.4841 };
const END = { lng: -71.3487, lat: 19.4846 };
const SABANETA_STRETCH = [START, BEND, END];

describe("distanceMetres", () => {
  test("a point is no distance from itself", () => {
    expect(distanceMetres(START, START)).toBe(0);
  });

  test("is symmetric", () => {
    expect(distanceMetres(START, BEND)).toBeCloseTo(
      distanceMetres(BEND, START),
      6,
    );
  });

  test("a degree of latitude is about 111 km", () => {
    const metres = distanceMetres(
      { lng: -71.35, lat: 19.0 },
      { lng: -71.35, lat: 20.0 },
    );
    expect(metres).toBeGreaterThan(110_000);
    expect(metres).toBeLessThan(112_000);
  });
});

describe("pathLength", () => {
  test("agrees with PostGIS on a real stretch", () => {
    expect(Math.round(pathLength(SABANETA_STRETCH))).toBe(250);
  });

  test("a path of one point has no length", () => {
    expect(pathLength([START])).toBe(0);
    expect(pathLength([])).toBe(0);
  });

  test("adds the legs rather than measuring end to end", () => {
    // A bent path is longer than the straight line across it, which is the
    // whole reason the road's own shape is stored.
    const straight = distanceMetres(START, END);
    expect(pathLength(SABANETA_STRETCH)).toBeGreaterThan(straight);
  });
});

describe("pathMidpoint", () => {
  test("is halfway along the road, not the middle of the array", () => {
    // Two short legs then one long one: the middle vertex is nowhere near the
    // middle of the line, which is exactly the case a snapped road produces
    // — its vertices bunch at the corners.
    const west = { lng: -71.35, lat: 19.48 };
    const east = { lng: -71.34, lat: 19.48 };
    const bunched = [
      west,
      { lng: -71.3499, lat: 19.48 },
      { lng: -71.3498, lat: 19.48 },
      east,
    ];

    const middle = pathMidpoint(bunched);
    const toStart = distanceMetres(west, middle);
    const toEnd = distanceMetres(middle, east);

    expect(toStart).toBeCloseTo(toEnd, 0);
    // And it is not simply a stored vertex.
    expect(bunched.some((point) => point.lng === middle.lng)).toBe(false);
  });

  test("splits a real stretch into two equal halves", () => {
    const middle = pathMidpoint(SABANETA_STRETCH);
    const half = pathLength(SABANETA_STRETCH) / 2;

    expect(pathLength([START, middle])).toBeLessThanOrEqual(half + 1);
  });

  test("a single point is its own middle", () => {
    expect(pathMidpoint([BEND])).toEqual(BEND);
  });

  test("an empty path has no middle to give", () => {
    expect(() => pathMidpoint([])).toThrow();
  });
});

/**
 * Where the crosshair falls on a street, and how much of that street a report
 * covers. Both decide what gets shaded, and both fail quietly: a report on the
 * wrong stretch of road is not an error anywhere, it is just wrong advice.
 */
describe("nearestOnPath", () => {
  // A street running due east, drawn as two points a long way apart — which is
  // how OSM draws a straight road, and the case a nearest-*vertex* search gets
  // wrong.
  const WEST_END = { lng: -71.36, lat: 19.48 };
  const EAST_END = { lng: -71.34, lat: 19.48 };
  const street = [WEST_END, EAST_END];

  test("finds the foot of the perpendicular, not the nearest end", () => {
    const found = nearestOnPath(street, { lng: -71.35, lat: 19.481 });

    expect(found?.point.lng).toBeCloseTo(-71.35, 5);
    expect(found?.point.lat).toBeCloseTo(19.48, 5);
    // ~111 m north of the road, not the ~1 km to either end of it.
    expect(found?.distance).toBeLessThan(150);
  });

  test("clamps to the ends rather than running off the road", () => {
    const found = nearestOnPath(street, { lng: -71.3, lat: 19.48 });
    expect(found?.point.lng).toBeCloseTo(-71.34, 5);
  });

  test("a path with no segments has no nearest point", () => {
    expect(nearestOnPath([{ lng: -71.35, lat: 19.48 }], WEST_END)).toBeNull();
  });

  test("east–west distance is not overstated", () => {
    // Without scaling longitude by cos(latitude), a degree east reads as a
    // degree north and east–west streets look nearer than they are.
    const eastWest = nearestOnPath(street, { lng: -71.3, lat: 19.48 });
    expect(eastWest?.distance).toBeCloseTo(
      distanceMetres({ lng: -71.34, lat: 19.48 }, { lng: -71.3, lat: 19.48 }),
      0,
    );
  });
});

describe("windowAround", () => {
  // ~2.1 km of straight road: longer than one report should ever cover.
  const ROAD_START = { lng: -71.36, lat: 19.48 };
  const longRoad = [ROAD_START, { lng: -71.34, lat: 19.48 }];

  test("trims a long way to the stretch around the crosshair", () => {
    const anchor = { lng: -71.35, lat: 19.48 };
    const trimmed = windowAround(longRoad, anchor, 400);

    expect(Math.round(pathLength(trimmed))).toBeLessThanOrEqual(401);
    // ...and it is centred on where the person actually pointed.
    const middle = pathMidpoint(trimmed);
    expect(distanceMetres(middle, anchor)).toBeLessThan(5);
  });

  test("a road shorter than the window is returned whole", () => {
    const short = [START, BEND];
    const trimmed = windowAround(short, START, 1_200);

    expect(Math.round(pathLength(trimmed))).toBe(Math.round(pathLength(short)));
  });

  test("the window starts at the crosshair even at the end of a road", () => {
    // Anchored at one end, the whole budget goes the only way it can.
    const trimmed = windowAround(longRoad, ROAD_START, 400);
    expect(Math.round(pathLength(trimmed))).toBeLessThanOrEqual(201);
  });
});

describe("nearestRoad", () => {
  const north = {
    id: "north",
    path: [
      { lng: -71.36, lat: 19.4801 },
      { lng: -71.34, lat: 19.4801 },
    ],
  };
  const south = {
    id: "south",
    path: [
      { lng: -71.36, lat: 19.48 },
      { lng: -71.34, lat: 19.48 },
    ],
  };

  test("chooses the closer parallel road regardless of rendering order", () => {
    const point = { lng: -71.35, lat: 19.48009 };
    expect(nearestRoad([south, north], point, 20)?.road.id).toBe("north");
    expect(nearestRoad([north, south], point, 20)?.road.id).toBe("north");
  });

  test("limits pointer snapping to the visible hit radius", () => {
    expect(nearestRoad([south], { lng: -71.35, lat: 19.4801 }, 5)).toBeNull();
    expect(
      nearestRoad([south], { lng: -71.35, lat: 19.4801 }, 20)?.point.lat,
    ).toBe(19.48);
  });

  test("breaks intersection ties by identity rather than drawing order", () => {
    const crossing = {
      id: "crossing",
      path: [
        { lng: -71.35, lat: 19.47 },
        { lng: -71.35, lat: 19.49 },
      ],
    };
    const point = { lng: -71.35, lat: 19.48 };
    expect(nearestRoad([south, crossing], point, 20)?.road.id).toBe("crossing");
    expect(nearestRoad([crossing, south], point, 20)?.road.id).toBe("crossing");
  });

  test("ignores missing and degenerate geometry", () => {
    expect(nearestRoad([], START, 20)).toBeNull();
    expect(nearestRoad([{ id: "empty", path: [START] }], START, 20)).toBeNull();
  });
});
