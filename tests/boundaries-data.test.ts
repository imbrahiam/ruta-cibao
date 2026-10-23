import { describe, expect, test } from "bun:test";

/**
 * Geometry comes from the exact OSM administrative relations used by the
 * basemap. ONE's published municipality areas remain an independent sanity
 * check: a replacement that moves any municipality by more than 1% of its
 * official area fails before it can move the province in production.
 */
const OFFICIAL_KM2: Record<string, number> = {
  sabaneta: 801.4,
  moncion: 138.9,
  "villa-los-almacigos": 207.2,
};

const file = (await Bun.file(
  new URL("../data/boundaries/santiago-rodriguez.geojson", import.meta.url),
).json()) as {
  features: { properties: { id: string; pcode: string; areaSqKm: number } }[];
};

describe("municipal boundaries", () => {
  test("carry exactly the three municipalities, by ONE P-code", () => {
    expect(
      file.features
        .map((f) => `${f.properties.pcode}:${f.properties.id}`)
        .sort(),
    ).toEqual([
      "DO020301:sabaneta",
      "DO020302:villa-los-almacigos",
      "DO020303:moncion",
    ]);
  });

  test("match ONE's published areas within 1%", () => {
    for (const { properties } of file.features) {
      const official = OFFICIAL_KM2[properties.id];
      expect(official).toBeDefined();
      expect(
        Math.abs(properties.areaSqKm - (official ?? 0)) / (official ?? 1),
      ).toBeLessThan(0.01);
    }
  });
});
