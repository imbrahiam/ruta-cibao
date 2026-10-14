import { describe, expect, test } from "bun:test";

/**
 * The pinned municipal boundaries are ONE's, via OCHA COD-AB.
 *
 * These areas are the ones ONE publishes (2010 territorial division table) and
 * that COD-AB and OpenStreetMap both reproduce. A replacement file that moves
 * any municipality by more than 1% of its area fails here, before it can move
 * the province under a running platform.
 */
const OFFICIAL_KM2: Record<string, number> = {
  sabaneta: 801.4,
  moncion: 138.9,
  "villa-los-almacigos": 207.2,
};

const file = (await Bun.file(
  new URL("../data/boundaries/santiago-rodriguez.geojson", import.meta.url),
).json()) as {
  source: string;
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

  test("name their source and licence", () => {
    expect(file.source).toContain("Oficina Nacional de Estadística");
    expect(file.source).toContain("CC BY-IGO");
  });
});
