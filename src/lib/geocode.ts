/**
 * Turning what someone typed into a point on the map.
 *
 * An adapter, because the demo and the handover want different things: a hosted
 * geocoder is convenient now, and a municipality running this on its own server
 * should not be forced to depend on one — or to pay for it — later.
 *
 * Nominatim is the default because it is free and open, and its terms are met
 * here: results are bounded to the province, requests are throttled by the
 * platform's own rate limiter before they leave, and the attribution is shown
 * on the map.
 *
 * With no provider configured the search still works against the places the
 * province has put on the map, which is the part citizens actually search for.
 * Only street addresses are lost, and this is a province where addresses are
 * directions anyway.
 */
import { z } from "zod";
import { env } from "@/lib/env";

export type GeocodeResult = {
  name: string;
  /** A fuller description: the street, the section, the municipality. */
  context: string | null;
  lng: number;
  lat: number;
};

/** Results are clamped to the province; anything outside is noise here. */
const VIEWBOX = { west: -71.75, south: 19.15, east: -70.85, north: 19.75 };

const nominatimResult = z.array(
  z.object({
    display_name: z.string(),
    name: z.string().optional(),
    lat: z.string(),
    lon: z.string(),
  }),
);

const REQUEST_TIMEOUT_MS = 6_000;

export function isGeocodingEnabled(): boolean {
  return env.GEOCODER !== "none";
}

export async function geocode(
  query: string,
  limit = 5,
): Promise<GeocodeResult[]> {
  if (env.GEOCODER === "none" || query.trim().length < 3) return [];

  const url = new URL("/search", env.NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", "do");
  url.searchParams.set(
    "viewbox",
    `${VIEWBOX.west},${VIEWBOX.north},${VIEWBOX.east},${VIEWBOX.south}`,
  );
  // Not a preference: results outside the province are never useful.
  url.searchParams.set("bounded", "1");

  try {
    const response = await fetch(url, {
      headers: {
        // Nominatim's terms require identifying the application.
        "user-agent": `RutaCibao/0.1 (${env.APP_URL})`,
        "accept-language": "es",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const parsed = nominatimResult.safeParse(await response.json());
    if (!parsed.success) return [];

    return parsed.data.map((result) => ({
      name:
        result.name || result.display_name.split(",")[0] || result.display_name,
      context: result.display_name,
      lng: Number.parseFloat(result.lon),
      lat: Number.parseFloat(result.lat),
    }));
  } catch (error) {
    // A geocoder that is down degrades search to the province's own places,
    // which is the half people search for most. It is not worth an error.
    console.info(
      "geocoding unavailable",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
