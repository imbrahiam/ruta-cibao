import { describe, expect, test } from "bun:test";
import {
  DEFAULT_VIEW_MODE,
  googleMapTypeFor,
  VIEW_MODES,
} from "@/lib/map/view-mode";

describe("view modes", () => {
  test("each mode maps to a Google map type", () => {
    expect(googleMapTypeFor("mapa")).toBe("roadmap");
    expect(googleMapTypeFor("relieve")).toBe("terrain");
    // `hybrid`, not `satellite`: imagery with no labels leaves someone unable
    // to tell one green square from another, and the names are the point.
    expect(googleMapTypeFor("satelite")).toBe("hybrid");
  });

  test("the default is one of the modes offered", () => {
    expect(VIEW_MODES).toContain(DEFAULT_VIEW_MODE);
  });
});
