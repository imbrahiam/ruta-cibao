/**
 * How much of Google's own map to show.
 *
 * Google's cartography is kept — the greens and tans of farmland and hills are
 * what someone orients by in this province, and washing them into the app's
 * greys was telling them less about where they are.
 *
 * The one thing that is optional is Google's own places. Its restaurants,
 * hotels and shops are useful on a general map and are noise on this one: they
 * compete for attention with the places the province put there, which are the
 * whole reason it exists. So they can be turned off.
 */
export function googleMapStyle(
  showGooglePlaces: boolean,
): google.maps.MapTypeStyle[] {
  if (showGooglePlaces) return [];

  return [
    // Business listings and their icons, off. Parks stay: they are terrain,
    // not a listing, and hiding them would leave a hole in the landscape.
    { featureType: "poi.business", stylers: [{ visibility: "off" }] },
    { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
    { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
    { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
    { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
    { featureType: "poi.school", stylers: [{ visibility: "off" }] },
    { featureType: "poi.government", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
  ];
}
