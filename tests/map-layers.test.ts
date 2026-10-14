import { describe, expect, test } from "bun:test";
import type { MunicipalBoundaries } from "@/lib/map/boundaries";
import {
  CLUSTERS_LAYER_ID,
  CLUSTERS_SINGLE_LAYER_ID,
  clusterLayers,
  INTERACTIVE_LAYER_IDS,
  PROVINCE_LABELS_SOURCE_ID,
  PROVINCE_SOURCE_ID,
  provinceLayers,
  provinceSources,
} from "@/lib/map/layers";
import { buildMapStyle } from "@/lib/map/style";

const square = (x: number, y: number) => ({
  type: "Polygon" as const,
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

const boundaries: MunicipalBoundaries = {
  features: [
    {
      properties: { id: "sabaneta", name: "Sabaneta", label: [0.5, 0.5] },
      geometry: square(0, 0),
    },
    // No label point: drawn, but not named.
    { properties: { id: "moncion", name: "Monción" }, geometry: square(1, 0) },
  ],
  outside: square(5, 5),
};

describe("clusters", () => {
  test("a cell of one is a pin, never a bubble reading 1", () => {
    const layers = clusterLayers();
    const bubble = layers.find((layer) => layer.id === CLUSTERS_LAYER_ID);
    const single = layers.find(
      (layer) => layer.id === CLUSTERS_SINGLE_LAYER_ID,
    );
    expect(
      JSON.stringify(bubble && "filter" in bubble && bubble.filter),
    ).toContain('["!",["==",["get","count"],1]]');
    expect(single?.type).toBe("symbol");
    expect(INTERACTIVE_LAYER_IDS).toContain(CLUSTERS_SINGLE_LAYER_ID);
  });
});

describe("province", () => {
  test("outlines every municipality, masks the rest, names the labelled", () => {
    const sources = provinceSources(boundaries);
    const shapes = sources[PROVINCE_SOURCE_ID];
    const labels = sources[PROVINCE_LABELS_SOURCE_ID];
    if (shapes?.type !== "geojson" || labels?.type !== "geojson") {
      throw new Error("expected geojson sources");
    }
    const kinds = (
      shapes.data as unknown as { features: { properties: { kind: string } }[] }
    ).features.map((feature) => feature.properties.kind);
    expect(kinds).toEqual(["municipality", "municipality", "outside"]);
    expect(
      (
        labels.data as unknown as {
          features: { properties: { name: string } }[];
        }
      ).features.map((feature) => feature.properties.name),
    ).toEqual(["Sabaneta"]);
  });

  test("every province layer reads a source provinceSources defines", () => {
    const ids = Object.keys(provinceSources(boundaries));
    for (const layer of provinceLayers()) {
      expect(ids).toContain("source" in layer ? String(layer.source) : "");
    }
  });
});

test("the basemap's own points of interest stay off the map", () => {
  const style = buildMapStyle(
    { kind: "pmtiles", url: "/basemap/x.pmtiles" },
    "https://rutacibao.example.do",
  );
  expect(style.layers.some((layer) => layer.id === "pois")).toBe(false);
});
