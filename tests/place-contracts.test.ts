import { describe, expect, test } from "bun:test";
import { reportPlaceInput, submitPlaceInput } from "@/modules/places/contracts";

const validSubmission = {
  requestId: "d7f66c55-5d18-466c-a220-bb45892cc580",
  name: "Farmacia San José",
  description: "Farmacia comunitaria frente al parque municipal.",
  categoryId: "salud",
  municipalityId: "sabaneta",
  location: { lng: -71.35, lat: 19.48 },
};

describe("place submission boundary", () => {
  test("accepts a complete provincial place", () => {
    expect(submitPlaceInput.safeParse(validSubmission).success).toBe(true);
  });

  test("rejects coordinates outside the province", () => {
    expect(
      submitPlaceInput.safeParse({
        ...validSubmission,
        location: { lng: -69.9, lat: 18.5 },
      }).success,
    ).toBe(false);
  });

  test("requires useful identifying detail", () => {
    expect(
      submitPlaceInput.safeParse({
        ...validSubmission,
        description: "Farmacia",
      }).success,
    ).toBe(false);
  });
});

describe("place correction boundary", () => {
  test("requires context for the catch-all reason", () => {
    const result = reportPlaceInput.safeParse({
      requestId: validSubmission.requestId,
      placeId: "a724b8a9-9165-487d-886e-5330ac23739c",
      reason: "other",
      details: "Muy corto",
    });

    expect(result.success).toBe(false);
  });

  test("allows a known reason without optional details", () => {
    const result = reportPlaceInput.safeParse({
      requestId: validSubmission.requestId,
      placeId: "a724b8a9-9165-487d-886e-5330ac23739c",
      reason: "closed",
    });

    expect(result.success).toBe(true);
  });
});
