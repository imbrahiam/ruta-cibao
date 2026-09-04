import { describe, expect, test } from "bun:test";
import {
  DEFAULT_VIEW_MODE,
  VIEW_MODES,
  acceptsCustomStyle,
  googleMapTypeFor,
} from "@/lib/map/view-mode";

describe("view modes", () => {
  test("each mode maps to a Google map type", () => {
    expect(googleMapTypeFor("mapa")).toBe("roadmap");
    expect(googleMapTypeFor("relieve")).toBe("terrain");
    // `hybrid`, not `satellite`: imagery with no labels leaves someone unable
    // to tell one green square from another, and the names are the point.
    expect(googleMapTypeFor("satelite")).toBe("hybrid");
  });

  test("custom styling only applies to the street map", () => {
    // Terrain and imagery are photographs; Google drops a style there silently,
    // so passing one would look like a bug in our palette rather than a no-op.
    expect(acceptsCustomStyle("mapa")).toBe(true);
    expect(acceptsCustomStyle("relieve")).toBe(false);
    expect(acceptsCustomStyle("satelite")).toBe(false);
  });

  test("the default is one of the modes offered", () => {
    expect(VIEW_MODES).toContain(DEFAULT_VIEW_MODE);
  });
});
