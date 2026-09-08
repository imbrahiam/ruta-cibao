import type { RoadAnchor } from "@/lib/map/road-geometry";
import type { ViewMode } from "@/lib/map/view-mode";
import type { CommunityFeature } from "@/modules/routes/map-features";

/**
 * What a renderer reports when someone taps a place, or taps away from one.
 *
 * The name and category come along because the tile already carries them. That
 * is what lets the drawer open with the real title and the right coloured chip
 * on the same frame as the tap, leaving only the description, the photo and the
 * address to stream in — instead of a spinner where the name should be.
 */
export type PlaceSelection = {
  id: string;
  slug: string;
  name?: string;
  categoryId?: string;
} | null;

/**
 * One traffic report, as the map draws it.
 *
 * A trimmed copy of what `traffic.active` returns: the renderer needs a point,
 * a colour and an icon, and nothing about who reported it or who agreed.
 */
export type TrafficPin = {
  id: string;
  lng: number;
  lat: number;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  /** Drawn as a line along the road when the report is a stretch. */
  path: { lng: number; lat: number }[] | null;
  /** `cleared` roads are drawn green and carry no marker. */
  state: "active" | "cleared";
  /** Decides the road's colour. Set by the municipality on the category. */
  severity: "blocking" | "partial" | "minor" | null;
};

/** The props every map renderer takes, so they stay interchangeable. */
export type CitizenMapProps = {
  communityFeatures?: CommunityFeature[];
  onSelectCommunity?: (feature: CommunityFeature) => void;
  selectedId: string | null;
  categoryIds: string[];
  /** Where a search result asked the map to go, and how close to get. */
  flyTo: {
    lng: number;
    lat: number;
    zoom?: number;
    /**
     * Pixels to displace the point from the viewport centre, DOM convention
     * (x right, y down). Opening a place also opens its drawer over the map,
     * and without this the pin lands dead centre — underneath the sheet.
     */
    offset?: { x: number; y: number };
  } | null;
  /** A geocoder or Google result that is not one of the app's own places. */
  searchMarker?: { lng: number; lat: number; label: string } | null;
  /**
   * Live traffic, where the renderer has it. Google does; the self-hosted
   * basemaps do not, and ignore this rather than pretending otherwise.
   *
   * This is the *road* layer — green through red along each road — not what
   * citizens report. The two sit side by side on purpose: the official layer
   * says a road is slow, and `trafficReports` says why.
   */
  traffic?: boolean;
  /**
   * What citizens reported, drawn as coloured roads and markers.
   *
   * Separate from `traffic` above, which is Google's speed layer. The two are
   * meant to be readable together: one says a road is slow, this one says why —
   * and covers the rural roads the other has no data for at all.
   */
  trafficReports?: TrafficPin[];
  selectedTrafficId?: string | null;
  onSelectTraffic?: (id: string | null) => void;
  /**
   * Street, terrain or satellite. Renderers without imagery fall back to their
   * own basemap rather than pretending to offer a choice they cannot honour.
   */
  viewMode?: ViewMode;
  /** Google's own listings. Renderers without them ignore this. */
  googlePlaces?: boolean;
  /** Where the person is, once they have asked to be found. */
  myLocation?: { lng: number; lat: number } | null;
  /** While true, the viewport's centre is choosing a new place. */
  pickingLocation?: boolean;
  /**
   * The street currently chosen, shaded while the crosshair is open.
   *
   * Renderers without a line layer ignore it, like the rest of the optional
   * props.
   */
  draftPath?: { lng: number; lat: number }[] | null;
  /**
   * Where on the chosen street the person pointed, when it was a tap.
   *
   * A tap lands beside a road, not on it; this is the foot of the perpendicular
   * onto the centre line, drawn as a dot so the map shows what it understood.
   * Null while the crosshair is doing the pointing — the pin is the dot then.
   */
  draftAnchor?: { lng: number; lat: number } | null;
  /**
   * The street under the pointer, shaded more faintly than the chosen one.
   *
   * Desktop only in practice: it is fed by `onHoverPoint`, and a touch screen
   * has no hover to report. On a phone the same job is done by tapping the
   * street, which selects it outright.
   */
  hoverPath?: { lng: number; lat: number }[] | null;
  /**
   * A tap on the map while choosing a point.
   *
   * Separate from `onSelect`, which is about opening a place. While the
   * crosshair is out, a tap means "that road there" — the most direct way to
   * say it, and the one that needs no explaining on a phone.
   */
  onMapPoint?: (position: RoadAnchor) => void;
  /** Where the pointer is, throttled. Null when it leaves the map. */
  onHoverPoint?: (position: { lng: number; lat: number } | null) => void;
  /** Reports the settled centre and zoom after a pan or zoom. */
  onViewportChange?: (viewport: {
    lng: number;
    lat: number;
    zoom: number;
    bounds?: { west: number; east: number; south: number; north: number };
  }) => void;
  /**
   * Whether the map is being panned or zoomed right now. Picking a point uses
   * it to lift the crosshair off the ground while the map moves under it.
   */
  onMovingChange?: (moving: boolean) => void;
  onSelect: (place: PlaceSelection) => void;
};
