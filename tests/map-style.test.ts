import { describe, expect, test } from "bun:test";
import { mapPalette } from "@/lib/map/palette";
import { buildMapStyle } from "@/lib/map/style";

/**
 * The two hosted basemaps use different schemas, and a style written for one
 * renders nothing at all against the other — silently, with no error and a
 * blank white ground. These assert the layer names actually present in the
 * tiles, checked by decoding a real extract of the province.
 */
const ORIGIN = "https://rutacibao.example.do";

const PROTOMAPS_LAYERS = [
  "earth",
  "water",
  "landcover",
  "landuse",
  "roads",
  "buildings",
  "boundaries",
  "places",
  "pois",
];
const OPENMAPTILES_LAYERS = [
  "water",
  "landcover",
  "building",
  "transportation",
  "boundary",
  "place",
];

function sourceLayers(style: ReturnType<typeof buildMapStyle>): string[] {
  return style.layers
    .map((layer) =>
      "source-layer" in layer ? layer["source-layer"] : undefined,
    )
    .filter((name): name is string => name !== undefined);
}

describe("buildMapStyle", () => {
  test("a self-hosted extract is styled against the Protomaps schema", () => {
    const style = buildMapStyle(
      { kind: "pmtiles", url: "/basemap/santiago-rodriguez.pmtiles" },
      ORIGIN,
    );

    for (const layer of sourceLayers(style)) {
      expect(PROTOMAPS_LAYERS).toContain(layer);
    }
    expect(sourceLayers(style)).toContain("roads");
    // The official generator covers far more than the eight layers that were
    // hand-written here; a handful would mean it is not being used.
    expect(style.layers.length).toBeGreaterThan(40);
  });

  test("a self-hosted basemap points at its own sprite", () => {
    // Route shields, one-way arrows and POI icons are sprite images: without
    // one those layers render nothing. And MapLibre rejects a relative sprite
    // URL outright, unlike glyphs and tiles, so it has to be absolute.
    expect(
      buildMapStyle({ kind: "pmtiles", url: "/x.pmtiles" }, ORIGIN).sprite,
    ).toBe(`${ORIGIN}/sprites/light`);
  });

  test("MapTiler is styled against OpenMapTiles", () => {
    const style = buildMapStyle({ kind: "maptiler", key: "test-key" }, ORIGIN);

    for (const layer of sourceLayers(style)) {
      expect(OPENMAPTILES_LAYERS).toContain(layer);
    }
    expect(sourceLayers(style)).toContain("transportation");
  });

  test("the two schemas are not interchangeable", () => {
    const protomaps = sourceLayers(
      buildMapStyle({ kind: "pmtiles", url: "/x.pmtiles" }, ORIGIN),
    );
    const maptiler = sourceLayers(
      buildMapStyle({ kind: "maptiler", key: "k" }, ORIGIN),
    );

    expect(protomaps).not.toContain("transportation");
    expect(maptiler).not.toContain("roads");
  });

  test("with no basemap the map is still a map, not an error", () => {
    const style = buildMapStyle({ kind: "none" }, ORIGIN);

    expect(Object.keys(style.sources)).toHaveLength(0);
    // A painted ground, so the citizen layer has something to sit on.
    expect(style.layers[0]?.type).toBe("background");
  });

  test("a self-hosted basemap serves its own glyphs", () => {
    expect(
      buildMapStyle({ kind: "pmtiles", url: "/x.pmtiles" }, ORIGIN).glyphs,
    ).toBe("/fonts/{fontstack}/{range}.pbf");
  });
});

/**
 * The first version of this palette made the map invisible: white land with
 * white roads on it, separated by a hairline under a pixel wide at province
 * zoom. Nothing failed, nothing logged, the map was simply blank. These hold
 * the contrast that stops it happening again.
 */
describe("mapPalette", () => {
  test("roads are brighter than the ground they sit on", () => {
    expect(mapPalette.road).not.toBe(mapPalette.land);
    expect(luminance(mapPalette.road)).toBeGreaterThan(
      luminance(mapPalette.land),
    );
  });

  test("water is distinguishable from land", () => {
    expect(
      Math.abs(luminance(mapPalette.water) - luminance(mapPalette.land)),
    ).toBeGreaterThan(8);
  });

  test("a marker's white ring reads against the ground", () => {
    expect(luminance(mapPalette.land)).toBeLessThan(luminance("#ffffff"));
  });
});

/** Rough perceived brightness, 0–255. Enough to compare two near-greys. */
function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * MapLibre rejects a style with two layers sharing an id, and the Protomaps
 * generator brings its own background — so adding one unconditionally broke
 * the map with "duplicate layer id background". Every source is checked,
 * because the mistake is easy to reintroduce and fatal when it happens.
 */
describe("layer ids", () => {
  for (const basemap of [
    { kind: "pmtiles", url: "/x.pmtiles" },
    { kind: "maptiler", key: "k" },
    { kind: "none" },
  ] as const) {
    test(`${basemap.kind}: no duplicates, exactly one background`, () => {
      const ids = buildMapStyle(basemap, ORIGIN).layers.map(
        (layer) => layer.id,
      );

      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.filter((id) => id === "background")).toHaveLength(1);
    });
  }
});
