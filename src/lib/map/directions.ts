/**
 * Handing a destination to the navigation app the phone already has.
 *
 * Deliberately not turn-by-turn of our own. People in the province already have
 * a maps app they trust, with their own offline regions downloaded and their
 * own voice guidance in their own language. Building a worse version of that,
 * that needs a data connection on a road where there is none, would be a step
 * backwards dressed as a feature.
 *
 * What routing this project does build is a different job: the ecotourism
 * routes need elevation profiles, difficulty and "what is within fifteen
 * minutes", which no general navigation app answers. That belongs with the
 * routes feature, not here.
 *
 * Plain functions returning a URL, so React Native passes the same string to
 * `Linking.openURL`.
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
