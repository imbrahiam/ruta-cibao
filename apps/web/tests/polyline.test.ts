import { describe, expect, test } from "bun:test";
import { computeDirectionsInput } from "@ruta/contracts";
import { decodePolyline } from "@ruta/shared/polyline";

describe("decodePolyline", () => {
  test("decodes the reference path including negative deltas", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  test("preserves zero coordinates and empty geometry", () => {
    expect(decodePolyline("????")).toEqual([
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
    ]);
    expect(decodePolyline("")).toEqual([]);
  });

  test("rejects incomplete, invalid and overflowing coordinates", () => {
    for (const encoded of [
      "?",
      "_",
      "!",
      "~~~~~~~~~~~~?",
      "_p~iF~ps|U~ps|U?~ps|U?",
    ]) {
      expect(() => decodePolyline(encoded)).toThrow();
    }
  });
});

describe("directions input", () => {
  const input = {
    origin: { lat: 19.4769, lng: -71.341 },
    destination: { lat: 19.4105, lng: -71.1565 },
    mode: "drive",
  };

  test("accepts a provincial journey but not an overseas origin", () => {
    expect(computeDirectionsInput.safeParse(input).success).toBe(true);
    expect(
      computeDirectionsInput.safeParse({
        ...input,
        origin: { lat: 40.7, lng: -74 },
      }).success,
    ).toBe(false);
    expect(
      computeDirectionsInput.safeParse({ ...input, mode: "fly" }).success,
    ).toBe(false);
  });
});
