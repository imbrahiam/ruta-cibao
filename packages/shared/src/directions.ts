/**
 * Optional handoff from the in-app route preview to an installed navigation app.
 * Plain URLs let native callers use Linking with an HTTPS fallback.
 */
export type Destination = {
  lat: number;
  lng: number;
  label?: string;
};

export type DevicePlatform = "ios" | "android" | "other";

/**
 * Best guess at the platform, from the user agent.
 *
 * Guessing is acceptable here because being wrong is cheap: every branch
 * produces a URL that opens *a* map, just not necessarily the preferred one.
 */
export function detectPlatform(userAgent: string): DevicePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "other";
}

export function directionsUrl(
  destination: Destination,
  platform: DevicePlatform,
): string {
  const { lat, lng } = destination;
  const label = destination.label ? encodeURIComponent(destination.label) : "";

  switch (platform) {
    case "ios":
      // Apple Maps is installed on every iPhone and cannot be removed, so this
      // always resolves; `q` gives the pin a readable name.
      return `maps://?daddr=${lat},${lng}${label ? `&q=${label}` : ""}`;

    case "android":
      // A geo: URI lets the person's own default app answer — which may be
      // Google Maps, or Organic Maps with the province downloaded offline.
      return `geo:${lat},${lng}?q=${lat},${lng}${label ? `(${label})` : ""}`;

    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
}
