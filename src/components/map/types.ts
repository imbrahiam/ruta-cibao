/** What a renderer reports when someone taps a place, or taps away from one. */
export type PlaceSelection = { id: string; slug: string } | null;

/** The props every map renderer takes, so they stay interchangeable. */
export type CitizenMapProps = {
  selectedId: string | null;
  categoryIds: string[];
  /** Where a search result asked the map to go. */
  flyTo: { lng: number; lat: number } | null;
  onSelect: (place: PlaceSelection) => void;
};
