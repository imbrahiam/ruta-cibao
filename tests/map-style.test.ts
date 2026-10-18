import { describe, expect, test } from "bun:test";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import { MAP_FONTS, MAP_PALETTES } from "@/lib/map/palette";
import { basemapStyle } from "@/lib/map/style";

const THEMES = ["light", "dark"] as const;

function style(theme: (typeof THEMES)[number]) {
  return basemapStyle({
    theme,
    pmtilesUrl: "https://example.test/basemap.pmtiles",
    attribution: "© OpenStreetMap",
  });
}

describe("the hand-written basemap style", () => {
  for (const theme of THEMES) {
    test(`${theme} validates against the MapLibre style spec`, () => {
      expect(validateStyleMin(style(theme))).toEqual([]);
    });
  }

  test("light and dark draw the same layers in the same order", () => {
    const ids = (theme: (typeof THEMES)[number]) =>
      style(theme).layers.map((layer) => layer.id);
    expect(ids("dark")).toEqual(ids("light"));
  });

  test("every label uses a font stack the glyph builder produces", async () => {
    const script = await Bun.file("scripts/basemap-glyphs.ts").text();
    const built = [...script.matchAll(/name: "([^"]+)"/g)].map(
      (match) => match[1],
    );
    const used = new Set(
      style("light").layers.flatMap((layer) =>
        layer.type === "symbol" && Array.isArray(layer.layout?.["text-font"])
          ? (layer.layout["text-font"] as string[])
          : [],
      ),
    );
    for (const stack of Object.values(MAP_FONTS).flat())
      expect(built).toContain(stack);
    for (const font of used) expect(built).toContain(font);
  });

  test("the ground stays neutral: no traffic colour appears in the palette", () => {
    for (const palette of Object.values(MAP_PALETTES)) {
      const values = Object.values(palette).map(String);
      for (const traffic of ["#dc2626", "#f59e0b", "#eab308", "#16a34a"]) {
        expect(values).not.toContain(traffic);
      }
    }
  });
});
