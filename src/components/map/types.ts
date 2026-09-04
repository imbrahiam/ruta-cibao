import type { ViewMode } from "@/lib/map/view-mode";

/** What a renderer reports when someone taps a place, or taps away from one. */
export type PlaceSelection = { id: string; slug: string } | null;

/** The props every map renderer takes, so they stay interchangeable. */
export type CitizenMapProps = {
  selectedId: string | null;
  categoryIds: string[];
  /** Where a search result asked the map to go. */
  flyTo: { lng: number; lat: number } | null;
  /**
   * Live traffic, where the renderer has it. Google does; the self-hosted
   * basemaps do not, and ignore this rather than pretending otherwise.
   */
  traffic?: boolean;
  /**
   * Street, terrain or satellite. Renderers without imagery fall back to their
   * own basemap rather than pretending to offer a choice they cannot honour.
   */
  viewMode?: ViewMode;
  onSelect: (place: PlaceSelection) => void;
};
