/**
 * How much of Google's own map to show.
 *
 * Google's cartography is kept — the greens and tans of farmland and hills are
 * what someone orients by in this province, and washing them into the app's
 * greys was telling them less about where they are.
 *
 * Two things are adjusted. Google's own places are optional: its restaurants,
 * hotels and shops are useful on a general map and are noise on this one, where
 * they compete with the places the province put there. And the administrative
 * lines Google already draws are brought forward, because the map now covers
 * the whole country and something has to say which part of it this is for.
 */

/**
 * The provincial line, drawn by Google rather than over it.
 *
 * Google renders administrative boundaries natively and fades them at low
 * zooms; this brings the province tier forward a step and keeps its name
 * legible. Highlighting *only* Santiago Rodríguez would need data-driven
 * styling, which needs a Map ID — and a Map ID makes Google ignore this entire
 * style object, taking the POI switch below with it. Emphasising every province
 * line is the version of this that does not cost the map its main feature.
 */
const ADMINISTRATIVE: google.maps.MapTypeStyle[] = [
  {
    featureType: "administrative.province",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "on" }, { color: "#64748b" }, { weight: 1.4 }],
  },
  {
    featureType: "administrative.province",
    elementType: "labels.text.fill",
    stylers: [{ visibility: "on" }, { color: "#475569" }],
  },
  // The municipal tier stays a hairline: it is context for the province line,
  // not a second thing competing with it.
  {
    featureType: "administrative.locality",
    elementType: "geometry.stroke",
    stylers: [{ visibility: "on" }, { color: "#94a3b8" }, { weight: 0.8 }],
  },
];

/**
 * Everything Google lists, off — then the ground it stands on, back.
 *
 * Naming the subtypes one at a time left whatever Google had not been told
 * about: parks and plazas kept their pins and labels, and so did anything in a
 * category added since. "Ocultar los lugares de Google" has to mean all of
 * them, so the whole `poi` tier goes and the exceptions are added back
 * deliberately.
 *
 * Park *geometry* is one of those exceptions. The green of a plaza is terrain —
 * it is how somebody recognises the middle of Monción — where its label and pin
 * are a listing competing with the ones the province put on the map. Turning
 * the fill back on keeps the first and not the second.
 */
const HIDDEN_PLACES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "on" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export function googleMapStyle(
  showGooglePlaces: boolean,
): google.maps.MapTypeStyle[] {
  return showGooglePlaces
    ? ADMINISTRATIVE
    : [...ADMINISTRATIVE, ...HIDDEN_PLACES];
}
