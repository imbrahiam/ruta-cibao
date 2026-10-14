import { describe, expect, test } from "bun:test";
import { stampInput } from "@/modules/passport/contracts";
import { visitProblem } from "@/modules/passport/visit-policy";

const now = Date.parse("2026-10-13T12:00:00Z");
describe("passport proximity boundary", () => {
  test("a current fix at the accuracy threshold is accepted", () => {
    expect(
      visitProblem(
        {
          accuracyMeters: 100,
          capturedAt: new Date(now - 60000).toISOString(),
        },
        now,
      ),
    ).toBeNull();
  });
  test("a coarse fix cannot turn a distant visit into a stamp", () => {
    expect(
      visitProblem(
        { accuracyMeters: 101, capturedAt: new Date(now).toISOString() },
        now,
      ),
    ).toBe("inaccurate");
  });
  test("stale and future fixes are rejected", () => {
    for (const time of [now - 60001, now + 5001])
      expect(
        visitProblem(
          { accuracyMeters: 10, capturedAt: new Date(time).toISOString() },
          now,
        ),
      ).toBe("stale");
  });
  test("invalid coordinates, accuracy and timestamps fail at the API boundary", () => {
    const valid = {
      placeId: crypto.randomUUID(),
      position: { lng: -71.3, lat: 19.45 },
      accuracyMeters: 20,
      capturedAt: new Date(now).toISOString(),
    };
    expect(stampInput.safeParse(valid).success).toBe(true);
    for (const bad of [
      { ...valid, position: { lng: 181, lat: 19 } },
      { ...valid, accuracyMeters: 0 },
      { ...valid, capturedAt: "yesterday" },
    ])
      expect(stampInput.safeParse(bad).success).toBe(false);
  });
});
