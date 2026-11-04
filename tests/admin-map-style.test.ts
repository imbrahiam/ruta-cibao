import { describe, expect, test } from "bun:test";
import { TRAFFIC_COLORS } from "@ruta/shared/traffic";
import { MAP_PALETTES } from "@/components/admin/map/palette";
import {
  contrastRatio,
  MIN_CONTRAST,
  stretchColor,
  surfacesOf,
} from "@/components/admin/map/stretch-color";

const INK = { light: "#000000", dark: "#FFFFFF" } as const;

describe("stretch colour on the desk's basemap styles", () => {
  for (const style of Object.keys(
    MAP_PALETTES,
  ) as (keyof typeof MAP_PALETTES)[]) {
    for (const scheme of ["light", "dark"] as const) {
      test(`${style} ${scheme}: every severity colour and ink keeps 3:1`, () => {
        const surfaces = surfacesOf(style, scheme);
        for (const color of [...Object.values(TRAFFIC_COLORS), INK[scheme]]) {
          const drawn = stretchColor(color, style, scheme);
          for (const surface of surfaces) {
            expect(contrastRatio(drawn, surface)).toBeGreaterThanOrEqual(
              MIN_CONTRAST,
            );
          }
        }
      });
    }
  }

  test("a colour that already clears the bar is left alone", () => {
    expect(stretchColor("#000000", "colores", "light")).toBe("#000000");
  });
});
