import { describe, expect, test } from "bun:test";
import { markerPin, markerSize } from "@/lib/map/marker-pin";

/**
 * The pin is an SVG data URI, so nothing about it fails loudly — a broken one
 * renders as a missing image on a map nobody is inspecting. These check the
 * parts that would be silently wrong.
 */
describe("markerPin", () => {
  test("carries the category's colour and an icon", () => {
    const uri = decodeURIComponent(markerPin("#16a34a", "trees", false));

    expect(uri.startsWith("data:image/svg+xml")).toBe(true);
    expect(uri).toContain("#16a34a");
    // The lucide icon is rendered in, not referenced.
    expect(uri).toContain("<path");
  });

  test("an unknown icon still produces a pin", () => {
    expect(markerPin("#000000", "no-such-icon", false)).toContain(
      "data:image/svg+xml",
    );
  });

  test("the selected pin is larger", () => {
    expect(markerSize(true).height).toBeGreaterThan(markerSize(false).height);
  });

  test("the same inputs return the same string, so it is cacheable", () => {
    expect(markerPin("#dc2626", "cross", false)).toBe(
      markerPin("#dc2626", "cross", false),
    );
  });

  test("different categories produce different pins", () => {
    expect(markerPin("#dc2626", "cross", false)).not.toBe(
      markerPin("#16a34a", "trees", false),
    );
  });
});
