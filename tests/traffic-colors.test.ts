import { describe, expect, test } from "bun:test";
import {
  TRAFFIC_COLORS,
  trafficColor,
  trafficTone,
} from "@/lib/map/traffic-colors";

/**
 * The road's colour is the whole answer for a driver deciding which way to go,
 * and it is the one part of this feature that fails silently: a blocking report
 * drawn amber is not an error anywhere, it is just wrong advice.
 */
describe("trafficTone", () => {
  test("an active road takes its category's severity", () => {
    expect(trafficTone("active", "blocking")).toBe("blocking");
    expect(trafficTone("active", "partial")).toBe("partial");
    expect(trafficTone("active", "minor")).toBe("minor");
  });

  test("cleared beats whatever the problem was", () => {
    // A cleared landslide is not a red road. This is the case the layer exists
    // for — the answer to "can I go that way now" — so it must not be possible
    // for a severity to override it.
    for (const severity of ["blocking", "partial", "minor", null] as const) {
      expect(trafficTone("cleared", severity)).toBe("cleared");
    }
  });

  test("a category with no severity set is the honest middle", () => {
    // An official adding a category and leaving severity blank must not have
    // the map claim their new problem blocks the road.
    expect(trafficTone("active", null)).toBe("minor");
  });
});

describe("trafficColor", () => {
  test("uses the scale people already read", () => {
    expect(trafficColor("active", "blocking")).toBe(TRAFFIC_COLORS.blocking);
    expect(trafficColor("cleared", "blocking")).toBe(TRAFFIC_COLORS.cleared);
  });

  test("every tone has its own colour", () => {
    const colors = Object.values(TRAFFIC_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });
});
