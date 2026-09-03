import { describe, expect, test } from "bun:test";
import { detectPlatform, directionsUrl } from "@/lib/map/directions";

const destination = { lat: 19.4494, lng: -71.1508, label: "Presa de Monción" };

describe("detectPlatform", () => {
  test("recognises the phones this province uses", () => {
    expect(
      detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"),
    ).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 13; SM-A125F)")).toBe(
      "android",
    );
    expect(
      detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe("other");
  });
});

describe("directionsUrl", () => {
  test("iOS opens Apple Maps, which cannot be uninstalled", () => {
    expect(directionsUrl(destination, "ios")).toContain(
      "maps://?daddr=19.4494,-71.1508",
    );
  });

  // The point of geo: is that the person's own default answers — which may be
  // an offline-capable app with the province already downloaded.
  test("Android hands off to whichever map app is default", () => {
    const url = directionsUrl(destination, "android");
    expect(url.startsWith("geo:19.4494,-71.1508")).toBe(true);
    expect(url).toContain("(Presa%20de%20Monci%C3%B3n)");
  });

  test("anything else gets a plain web link", () => {
    expect(directionsUrl(destination, "other")).toContain(
      "google.com/maps/dir/",
    );
  });

  test("a destination with no name still produces a usable link", () => {
    const url = directionsUrl({ lat: 19.4, lng: -71.1 }, "android");
    expect(url).toBe("geo:19.4,-71.1?q=19.4,-71.1");
  });
});
