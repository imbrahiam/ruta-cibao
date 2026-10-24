import { describe, expect, test } from "bun:test";
import { googleMatchDistance } from "@/modules/places/google-photo";
import { placeThumbnail } from "@/modules/places/thumbnail";

describe("place thumbnail precedence", () => {
  test("published app imagery wins over a cached Google match", async () => {
    expect(
      await placeThumbnail({
        id: "place",
        appThumbnailKey: "/photos/place.webp",
        googlePlaceId: "google-id",
      }),
    ).toEqual({
      thumbnailUrl: "/photos/place.webp",
      thumbnailSource: "app",
    });
  });

  test("cached Google IDs expose only the app's redirect route", async () => {
    expect(
      await placeThumbnail({
        id: "place",
        appThumbnailKey: null,
        googlePlaceId: "google-id",
      }),
    ).toEqual({
      thumbnailUrl: "/api/places/place/thumbnail",
      thumbnailSource: "google",
    });
  });

  test("unmatched places have no thumbnail", async () => {
    expect(
      await placeThumbnail({
        id: "place",
        appThumbnailKey: null,
        googlePlaceId: null,
      }),
    ).toEqual({
      thumbnailUrl: null,
      thumbnailSource: null,
    });
  });
});

describe("Google match geographic boundary", () => {
  const origin = { x: -71.341, y: 19.477 };
  test("identical coordinates match and nearby points remain inside 250 metres", () => {
    expect(
      googleMatchDistance(origin, { longitude: origin.x, latitude: origin.y }),
    ).toBe(0);
    expect(
      googleMatchDistance(origin, {
        longitude: origin.x,
        latitude: origin.y + 0.002,
      }),
    ).toBeLessThan(250);
  });
  test("a similar place more than 250 metres away cannot match", () => {
    expect(
      googleMatchDistance(origin, {
        longitude: origin.x,
        latitude: origin.y + 0.003,
      }),
    ).toBeGreaterThan(250);
  });
});
