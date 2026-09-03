import { describe, expect, test } from "bun:test";
import { buildMapStyle } from "@/lib/map/style";

/**
 * The two hosted basemaps use different schemas, and a style written for one
 * renders nothing at all against the other — silently, with no error and a
 * blank white ground. These assert the layer names actually present in the
 * tiles, checked by decoding a real extract of the province.
 */
const PROTOMAPS_LAYERS = [
  "earth",
  "water",
  "landuse",
  "roads",
  "buildings",
  "boundaries",
  "places",
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
    const style = buildMapStyle({
      kind: "pmtiles",
      url: "/basemap/santiago-rodriguez.pmtiles",
    });

    for (const layer of sourceLayers(style)) {
      expect(PROTOMAPS_LAYERS).toContain(layer);
    }
    expect(sourceLayers(style)).toContain("roads");
  });

  test("MapTiler is styled against OpenMapTiles", () => {
    const style = buildMapStyle({ kind: "maptiler", key: "test-key" });

    for (const layer of sourceLayers(style)) {
      expect(OPENMAPTILES_LAYERS).toContain(layer);
    }
    expect(sourceLayers(style)).toContain("transportation");
  });

  test("the two schemas are not interchangeable", () => {
    const protomaps = sourceLayers(
      buildMapStyle({ kind: "pmtiles", url: "/x.pmtiles" }),
    );
    const maptiler = sourceLayers(
      buildMapStyle({ kind: "maptiler", key: "k" }),
    );

    expect(protomaps).not.toContain("transportation");
    expect(maptiler).not.toContain("roads");
  });

  test("with no basemap the map is still a map, not an error", () => {
    const style = buildMapStyle({ kind: "none" });

    expect(Object.keys(style.sources)).toHaveLength(0);
    // A painted ground, so the citizen layer has something to sit on.
    expect(style.layers[0]?.type).toBe("background");
  });

  test("a self-hosted basemap serves its own glyphs", () => {
    expect(buildMapStyle({ kind: "pmtiles", url: "/x.pmtiles" }).glyphs).toBe(
      "/fonts/{fontstack}/{range}.pbf",
    );
  });
});
