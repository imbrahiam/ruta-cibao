"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryState,
} from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddPlaceDrawer } from "@/components/map/add-place-drawer";
import { CategoryChips } from "@/components/map/category-chips";
import { CitizenMap } from "@/components/map/citizen-map";
import { MapActions } from "@/components/map/map-actions";
import { MapLayers } from "@/components/map/map-layers";
import {
  googlePlacesSearchEnabled,
  MapProvider,
} from "@/components/map/map-provider";
import { MapSearch, type SearchTarget } from "@/components/map/map-search";
import { PickLocation } from "@/components/map/pick-location";
import { PEEK_SNAP, PlaceDrawer } from "@/components/map/place-drawer";
import { ReportTrafficDrawer } from "@/components/map/report-traffic-drawer";
import { TrafficDrawer } from "@/components/map/traffic-drawer";
import type { CitizenMapProps, PlaceSelection } from "@/components/map/types";
import { useCommunityMap } from "@/components/map/use-community-map";
import { InstallSplash } from "@/components/offline/install-splash";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRealtime } from "@/hooks/use-realtime";
import { useViewPreferences } from "@/hooks/use-view-preferences";
import {
  DEFAULT_ZOOM,
  isSubmittable,
  PROVINCE_CENTER,
  REGION_CENTER,
  STREET_ZOOM,
} from "@/lib/map/config";
import { markerSize } from "@/lib/map/marker-pin";
import {
  DEFAULT_STREET_EXTENT,
  nearestRoad,
  type RoadAnchor,
  type Street,
  type StreetExtent,
} from "@/lib/map/road-geometry";
import {
  DEFAULT_VIEW_MODE,
  VIEW_MODES,
  type ViewMode,
} from "@/lib/map/view-mode";
import {
  CROSSHAIR_FRACTION,
  crosshairOffsetPx,
  metresPerPixel,
  pointAtHeightFraction,
  type Viewport,
} from "@/lib/map/viewport";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * The map screen.
 *
 * Every piece of state lives in the URL rather than in component state: which
 * place is open, which categories are on, how the ground is drawn, whether
 * traffic is shown. That makes any view shareable by pasting the address,
 * survivable across the reload a phone does when it drops signal, and closable
 * with the back button — the gesture people reach for before they look for a
 * close affordance.
 *
 * Defaults write no parameter, so a plain link stays clean.
 */
function asViewMode(value: string): ViewMode {
  // A value typed into the URL by hand can be anything.
  return VIEW_MODES.includes(value as ViewMode)
    ? (value as ViewMode)
    : DEFAULT_VIEW_MODE;
}

/**
 * Below this a view is not somewhere a point can be chosen from, so entering
 * pick mode reframes rather than dropping the crosshair where the map happens
 * to be sitting. The same threshold decides when roads are drawn as tappable
 * bands — see `STREET_ZOOM`.
 */
const PICK_USABLE_ZOOM = STREET_ZOOM;

/**
 * Where picking starts when the current view is no use.
 *
 * The three municipalities fill the screen at this zoom — near enough to read
 * the towns, wide enough to still be looking rather than to have already
 * chosen. Deliberately not `MIN_ZOOM`, which frames the whole country, and
 * deliberately not a close zoom: arriving at street level on a spot nobody
 * picked is how the crosshair used to land 35 km east of the province.
 */
const PICK_BROWSE_ZOOM = 10.5;

/**
 * Where the crosshair should open.
 *
 * Asked of the view itself rather than of a "has the person moved the map yet"
 * flag. That flag was compared against the opening centre with `!==` on
 * floating-point degrees, and Google reports its settled centre to the last
 * decimal place — so it read as "moved" on the very first idle event, every
 * time, and picking flew to the region's centre at street zoom: a spot outside
 * the province that nobody had chosen.
 *
 * A view is kept when it is somewhere a point could sensibly be picked from:
 * inside the province, and close enough to see streets. Anything else opens on
 * the province.
 */
function pickView(viewport: Viewport): Viewport {
  const usable =
    viewport.zoom >= PICK_USABLE_ZOOM &&
    isSubmittable({ lng: viewport.lng, lat: viewport.lat });

  return usable
    ? viewport
    : {
        lng: PROVINCE_CENTER.longitude,
        lat: PROVINCE_CENTER.latitude,
        zoom: PICK_BROWSE_ZOOM,
      };
}

/**
 * What the map asks the traffic endpoint for.
 *
 * A generous box around the viewport rather than the viewport itself: a small
 * pan should not cost a round trip, and a report just off the edge is one the
 * reader is about to need. The zoom is not part of it — a blocked road matters
 * at every zoom, unlike a colmado.
 */
function trafficBounds(viewport: Viewport) {
  const span = Math.max(0.08, (24 / 2 ** viewport.zoom) * 40);

  return {
    west: viewport.lng - span,
    east: viewport.lng + span,
    south: viewport.lat - span,
    north: viewport.lat + span,
  };
}

/** What the crosshair is being used for. */
type PickPurpose = "place" | "traffic";

/** Whether a traffic report covers the street or one point of it. */
type PickShape = "point" | "street";

/**
 * How far from a finger a road may be and still be the one that was tapped.
 *
 * In pixels rather than metres, because the finger is the same size at every
 * zoom: at street zoom a fixed 45 m was under twenty pixels, and taps that
 * landed a thumb's width off a road missed it. Half a comfortable tap target.
 */
const TAP_RADIUS_PX = 22;

/**
 * How much of the right edge the desktop sheet takes: a 26rem panel with a
 * 0.75rem inset, both set in `ui/drawer.tsx`.
 */
const DESKTOP_DRAWER_PX = 416 + 12;

/**
 * How close a place opened from a link is worth showing.
 *
 * Street level — near enough to read the block it is on, wide enough to still
 * see which road leads there.
 */
const PLACE_ZOOM = 16;

/**
 * Where the pin has to land for the drawer not to cover it.
 *
 * Measured rather than guessed: the map frame is not the viewport — the rail
 * takes width on a desktop and the bottom navigation takes height on a phone,
 * while the sheet is positioned against the *viewport*. So the strip that
 * stays visible is worked out in viewport coordinates and then expressed as a
 * displacement from the frame's own centre, which is what the renderers take.
 *
 * The sheet covers the bottom of a phone and the right of a desktop; the
 * search row and the chips cover the top of both. What is left is where the
 * pin goes, plus half its height, because a pin is anchored by its tip and it
 * is the pin that should look centred, not the ground under it.
 */
function drawerOffset(
  frame: DOMRect,
  overlayHeight: number,
  isDesktop: boolean,
): { x: number; y: number } {
  const right = isDesktop
    ? Math.min(frame.right, window.innerWidth - DESKTOP_DRAWER_PX)
    : frame.right;
  const top = frame.top + overlayHeight;
  const bottom = isDesktop
    ? frame.bottom
    : Math.min(frame.bottom, window.innerHeight * (1 - PEEK_SNAP));

  // A frame with no room left in it — a very short window, a sheet wider than
  // the map — has no better answer than the centre.
  if (right <= frame.left || bottom <= top) return { x: 0, y: 0 };

  return {
    x: Math.round((frame.left + right) / 2 - (frame.left + frame.right) / 2),
    y: Math.round(
      (top + bottom) / 2 -
        (frame.top + frame.bottom) / 2 +
        markerSize(true).height / 2,
    ),
  };
}

export function MapScreen({ account }: { account?: React.ReactNode }) {
  const [slug, setSlug] = useQueryState(
    "lugar",
    // `history: push` so back closes the drawer instead of leaving the map.
    parseAsString.withOptions({ history: "push", shallow: true }),
  );
  const [categoryIds, setCategoryIds] = useQueryState(
    "cat",
    parseAsArrayOf(parseAsString)
      .withDefault([])
      .withOptions({ shallow: true }),
  );
  const {
    viewMode,
    setViewMode,
    traffic,
    setTraffic,
    alerts,
    setAlerts,
    googlePlaces,
    setGooglePlaces,
  } = useViewPreferences();

  // The tile carries the feature id and the drawer needs the slug, so both are
  // kept: the slug in the URL because it is what a person would read, the id in
  // memory because it is what the map matches when highlighting the selection.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // What the tile already knew about the tapped place, so the drawer opens
  // with its name and category rather than a spinner.
  const [preview, setPreview] = useState<{
    name: string;
    categoryId?: string;
  } | null>(null);
  const [flyTo, setFlyTo] = useState<CitizenMapProps["flyTo"]>(null);
  const [searchMarker, setSearchMarker] = useState<{
    lng: number;
    lat: number;
    label: string;
  } | null>(null);
  const [myLocation, setMyLocation] = useState<{
    lng: number;
    lat: number;
    accuracyMeters?: number;
  } | null>(null);
  /**
   * Whether the crosshair is out.
   *
   * Local state, not a URL parameter. Starting to pick also clears the open
   * place, and two nuqs writes in the same tick — one pushing, one replacing —
   * raced each other, so pressing "Agregar" sometimes produced no crosshair at
   * all. The URL keeps its job as an *entry point* below.
   */
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pickPurpose, setPickPurpose] = useState<PickPurpose>("place");
  /**
   * Whether a traffic report covers the street or one point of it.
   *
   * Held here rather than in the crosshair because the crosshair is unmounted
   * every time the form opens over it — going back from the form to move the
   * point should not silently change what the report covers.
   */
  const [pickShape, setPickShape] = useState<PickShape>("street");
  const [extentMeters, setExtentMeters] = useState<StreetExtent>(
    DEFAULT_STREET_EXTENT,
  );
  const [observedAt, setObservedAt] = useState("");
  // `?agregar=true` is how the rail opens pick mode from another screen. It is
  // consumed rather than kept: the parameter is a request, not the state.
  const [pickingRequested, setPickingRequested] = useQueryState(
    "agregar",
    parseAsBoolean.withDefault(false).withOptions({ shallow: true }),
  );
  // `?reportar=transito` is the same kind of request for a traffic report —
  // what the home-screen shortcut opens, so the most urgent thing the app does
  // is one long-press away from the icon.
  const [reportRequested, setReportRequested] = useQueryState(
    "reportar",
    parseAsString.withOptions({ shallow: true }),
  );
  const [mapMoving, setMapMoving] = useState(false);
  const [newPlace, setNewPlace] = useState<{
    lng: number;
    lat: number;
    source: "map" | "gps";
  } | null>(null);
  // Keep the confirmed preview visible while the report form is open.
  const [newTraffic, setNewTraffic] = useState<{
    lng: number;
    lat: number;
    shape: PickShape;
    roadId?: string;
    extentMeters: StreetExtent;
    observedAt: string;
    street?: Street;
  } | null>(null);
  /** The road being shaded under the crosshair while it is chosen. */
  const [draftPath, setDraftPath] = useState<
    { lng: number; lat: number }[] | null
  >(null);
  /**
   * The road the person is pointing at, when it is not the one under the
   * crosshair.
   *
   * Three ways to say "that street", because three are genuinely different
   * gestures: pan the crosshair over it, tap it, or — with a mouse — just move
   * over it. `tapped` wins until the map moves again, at which point the
   * crosshair is clearly the thing being aimed.
   */
  const [tapped, setTapped] = useState<RoadAnchor | null>(null);
  const [hoverPoint, setHoverPoint] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  // Which report's drawer is open. A URL parameter, because a traffic
  // notification links straight to one — `/mapa?reporte=<id>` is what
  // `notifications.trafficNearby` carries.
  //
  // Not `transito`: that one is already the Google traffic toggle in
  // `useViewPreferences`, and two features writing one parameter means opening
  // a report silently turns a layer on.
  const [trafficId, setTrafficId] = useQueryState(
    "reporte",
    parseAsString.withOptions({ history: "push", shallow: true }),
  );
  const [viewport, setViewport] = useState<Viewport>({
    lng: REGION_CENTER.longitude,
    lat: REGION_CENTER.latitude,
    zoom: DEFAULT_ZOOM,
  });
  // Read by `startPicking`, which must not be rebuilt on every pan.
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  /**
   * The map's height on screen, for placing the crosshair.
   *
   * The crosshair sits above centre so the card does not cover what it picks,
   * and every fly-to while picking has to land its target under the crosshair
   * rather than at the centre — which takes the offset in pixels.
   */
  const frameRef = useRef<HTMLDivElement>(null);
  /**
   * The search row and the chips, which cover the top of the map.
   *
   * Measured at the moment of a fly rather than watched: its height only
   * matters when something is about to be framed underneath it.
   */
  const overlayRef = useRef<HTMLDivElement>(null);
  const [frameHeight, setFrameHeight] = useState(0);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setFrameHeight(entry.contentRect.height);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);
  const crosshairOffset = useMemo(
    () => crosshairOffsetPx(frameHeight),
    [frameHeight],
  );

  const queryClient = useQueryClient();

  /**
   * The traffic layer's data.
   *
   * Keyed on a coarse box rather than the exact viewport, so panning a street
   * over reuses the cached answer instead of refetching. `staleTime` is
   * generous for the same reason the rest of the app's is: the live stream
   * pushes changes as they happen, and refetching on a timer would spend a
   * rural phone's data learning what an event already said.
   */
  const bounds = useMemo(
    () =>
      trafficBounds({
        lng: Math.round(viewport.lng * 20) / 20,
        lat: Math.round(viewport.lat * 20) / 20,
        zoom: Math.round(viewport.zoom),
      }),
    [viewport.lng, viewport.lat, viewport.zoom],
  );

  const community = useCommunityMap(bounds, setFlyTo);
  const { data: trafficReports = [] } = useQuery({
    ...orpc.traffic.active.queryOptions({ input: bounds }),
    staleTime: 60_000,
    // Not fetched with the layer off — this is a rural province on metered
    // data, and a layer nobody is looking at should not cost anything. The
    // exception is a link that opens one report directly: the drawer needs it
    // whether or not the roads are being drawn.
    enabled: alerts || trafficId !== null,
  });

  const refreshTraffic = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: orpc.traffic.active.key() });
  }, [queryClient]);

  // A report appearing, clearing or lapsing anywhere in the province arrives
  // here. The layer is small enough that refetching it beats patching the cache
  // by hand, and it keeps two maps open on two phones in step.
  useRealtime({ channels: ["traffic"], onEvent: refreshTraffic });

  const selectedTraffic = useMemo(
    () => trafficReports.find((report) => report.id === trafficId) ?? null,
    [trafficReports, trafficId],
  );

  const handleViewportChange = useCallback((next: Viewport) => {
    viewportRef.current = next;
    setViewport(next);
    // Moving the map is aiming the crosshair, which supersedes an earlier tap.
    setTapped(null);
  }, []);

  /**
   * Where the pointer is, rounded and therefore throttled.
   *
   * Five decimal places is about a metre — finer than any road is wide — and
   * rounding to it turns a stream of mousemove events into a handful of
   * distinct ones, each of which the street lookup has probably already
   * answered and cached.
   */
  const handleHoverPoint = useCallback(
    (point: { lng: number; lat: number } | null) => {
      setHoverPoint(
        point && {
          lng: Math.round(point.lng * 1e5) / 1e5,
          lat: Math.round(point.lat * 1e5) / 1e5,
        },
      );
    },
    [],
  );

  /**
   * Whether a street is being chosen right now.
   *
   * Gates both of the picker's lookups: neither the candidate highlight nor the
   * hover preview means anything while somebody is placing a plain point, and
   * asking for them would be work nobody sees.
   */
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const choosingStreet =
    pickingLocation && pickPurpose === "traffic" && pickShape === "street";

  /** The coordinate under the crosshair. */
  const aim = useMemo(
    () => pointAtHeightFraction(viewport, CROSSHAIR_FRACTION),
    [viewport],
  );
  /**
   * What is being pointed at: the last tapped road, or the crosshair.
   *
   * A point is always the crosshair. A tap there moves the map under it rather
   * than recording a second position, so there is never a tapped anchor to
   * prefer over the pin.
   *
   * Choosing a street, the crosshair only counts where one is actually drawn.
   * With a mouse there is none — the road under the pointer is the offer and a
   * click is the choice — so falling back to the crosshair there would select
   * a road nobody aimed at, and panning would silently change the answer.
   */
  const streetAnchor = !choosingStreet
    ? aim
    : (tapped ?? (isDesktop ? null : aim));

  const candidateQuery = useQuery({
    ...orpc.traffic.streetsInView.queryOptions({
      input: viewport.bounds ?? bounds,
    }),
    // Not while the whole province is on screen: at that zoom the box holds
    // thousands of ways, and the first two hundred and fifty of them is a blue
    // smear rather than a set of choices. The crosshair still works up there,
    // which is why it never went away.
    enabled: choosingStreet && viewport.zoom >= PICK_USABLE_ZOOM,
    staleTime: 60000,
  });

  const hoverStreet = useMemo(() => {
    if (!choosingStreet || !hoverPoint) return null;
    return nearestRoad(
      candidateQuery.data?.streets ?? [],
      hoverPoint,
      Math.min(45, metresPerPixel(viewport.lat, viewport.zoom) * 10),
    );
  }, [
    choosingStreet,
    hoverPoint,
    candidateQuery.data,
    viewport.lat,
    viewport.zoom,
  ]);

  /**
   * Which place the map is already framed on.
   *
   * A tap on a pin put the map where it needs to be before the drawer even
   * opened, so the resolve that follows must not move it again. A slug that
   * arrived any other way — a shared link, the directory, the saved list, the
   * back button — did not, so the map has to catch up once the coordinates are
   * known.
   *
   * The slug rather than a "came from a pin" flag, because this screen outlives
   * a visit to another one: the router keeps its state while it is hidden and
   * only rebuilds its effects. A boolean set by the last tap was therefore
   * still true when the directory opened a different place minutes later, and
   * that place never got its fly.
   */
  const framedSlug = useRef<string | null>(null);

  /**
   * Forget the framing when this screen is put away.
   *
   * What survives being hidden is the state, not the effects — and the map is
   * one of those, rebuilt at its opening view when the screen comes back. So a
   * place still recorded as framed would be one the rebuilt map is no longer
   * looking at.
   */
  useEffect(
    () => () => {
      framedSlug.current = null;
    },
    [],
  );

  const handleSelect = useCallback(
    (place: PlaceSelection) => {
      framedSlug.current = place?.slug ?? null;
      setSearchMarker(null);
      setSelectedId(place?.id ?? null);
      setPreview(
        place?.name ? { name: place.name, categoryId: place.categoryId } : null,
      );
      void setSlug(place?.slug ?? null);
    },
    [setSlug],
  );

  const handleResolved = useCallback(
    (place: { id: string; slug: string; lng: number; lat: number }) => {
      setSelectedId(place.id);
      if (framedSlug.current === place.slug) return;
      framedSlug.current = place.slug;
      const frame = frameRef.current?.getBoundingClientRect();
      setFlyTo({
        lng: place.lng,
        lat: place.lat,
        zoom: PLACE_ZOOM,
        offset: frame
          ? drawerOffset(
              frame,
              overlayRef.current?.getBoundingClientRect().height ?? 0,
              isDesktop,
            )
          : undefined,
      });
    },
    [isDesktop],
  );

  const close = useCallback(() => {
    framedSlug.current = null;
    setSearchMarker(null);
    setSelectedId(null);
    setPreview(null);
    void setSlug(null);
  }, [setSlug]);

  const stopPicking = useCallback(() => {
    setPickingLocation(false);
    setTapped(null);
    setHoverPoint(null);
  }, []);

  const beginPicking = useCallback(
    (purpose: PickPurpose) => {
      close();
      setNewPlace(null);
      setNewTraffic(null);
      setPickPurpose(purpose);
      setObservedAt(new Date().toISOString());
      setExtentMeters(DEFAULT_STREET_EXTENT);
      setPickShape("street");
      setPickingLocation(true);
    },
    [close],
  );

  /**
   * Back to the crosshair from the form, to move what was marked.
   *
   * Keeps whether the report covers the street or a point: coming back here
   * means the *place* was wrong, and silently changing what the report is about
   * would be answering a question nobody asked.
   */
  const pickAgain = useCallback((purpose: PickPurpose) => {
    setNewPlace(null);
    setNewTraffic(null);
    setPickPurpose(purpose);
    setPickingLocation(true);
  }, []);

  const startPicking = useCallback(
    (purpose: PickPurpose = "place") => {
      beginPicking(purpose);

      const target = pickView(viewportRef.current);
      // Only move when the view is not already the right one, so somebody who
      // had zoomed into their own street keeps exactly where they were.
      setFlyTo((current) =>
        target === viewportRef.current ? current : target,
      );
    },
    [beginPicking],
  );

  // `?agregar=true` goes through the same rule as the "+" menu: there is one
  // answer to "where should the crosshair open", and it depends on the view
  // rather than on how the person got here.
  useEffect(() => {
    if (!pickingRequested) return;
    void setPickingRequested(null);
    startPicking("place");
  }, [pickingRequested, setPickingRequested, startPicking]);

  useEffect(() => {
    if (reportRequested !== "transito") return;
    void setReportRequested(null);
    startPicking("traffic");
  }, [reportRequested, setReportRequested, startPicking]);

  return (
    <MapProvider>
      <div ref={frameRef} className="absolute inset-0">
        <CitizenMap
          communityFeatures={community.features}
          onSelectCommunity={(feature) => {
            close();
            void setTrafficId(null);
            community.select(feature);
          }}
          selectedId={selectedId}
          categoryIds={categoryIds}
          flyTo={flyTo}
          searchMarker={searchMarker}
          traffic={traffic}
          trafficReports={alerts ? trafficReports : []}
          selectedTrafficId={trafficId}
          onSelectTraffic={(id) => {
            if (id) close();
            void setTrafficId(id);
          }}
          googlePlaces={googlePlaces}
          myLocation={myLocation}
          pickingLocation={pickingLocation}
          draftPath={draftPath ?? newTraffic?.street?.path ?? null}
          draftAnchor={choosingStreet && tapped ? tapped : null}
          hoverPath={hoverStreet?.road.path ?? null}
          onMapPoint={(point) => {
            // Choosing a point: the tap says where, and the map brings the
            // crosshair to it. The pin stays the one mark of what will be sent —
            // a hidden anchor at the tap, with the pin still drawn at centre,
            // was two answers to "where" with only one of them visible.
            if (!choosingStreet) {
              setFlyTo({ ...point, offset: crosshairOffset });
              return;
            }
            // Nothing is tappable until the roads can be told apart.
            if (viewport.zoom < PICK_USABLE_ZOOM) return;
            if (point.roadId) {
              setTapped(point);
              return;
            }
            const nearest = nearestRoad(
              candidateQuery.data?.streets ?? [],
              point,
              metresPerPixel(viewport.lat, viewport.zoom) * TAP_RADIUS_PX,
            );
            // A tap between roads chose nothing, so it changes nothing: the
            // crosshair keeps aiming and no warning appears over a spot nobody
            // meant.
            if (!nearest) return;
            setTapped({ ...nearest.point, roadId: nearest.road.id });
          }}
          onHoverPoint={handleHoverPoint}
          onViewportChange={handleViewportChange}
          onMovingChange={setMapMoving}
          viewMode={asViewMode(viewMode)}
          onSelect={handleSelect}
        />

        {/* A soft wash under the search and chips. Over a busy stretch of map
            the white pills otherwise sit on white roads and labels, and the
            row loses its edge; ride-hailing and map apps put the same fade
            under their top bar. Only the top band, and gone while picking. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-linear-to-b from-background/80 via-background/35 to-transparent transition-opacity duration-200 md:h-24",
            pickingLocation && "opacity-0",
          )}
        />

        {/* Search and filters ride over the top of the map rather than above it,
          so the map keeps the full height of the screen. The account avatar
          shares the search row on a phone; the chips below get the full width.
          Edges respect the notch and home-indicator insets, so the search never
          slides under the Dynamic Island and the row never kisses a rounded
          corner in landscape. They step aside while a point is
          being chosen: nothing on screen then is about anything but the point. */}
        <div
          ref={overlayRef}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))] transition-opacity duration-200 md:flex-row md:flex-wrap md:items-center",
            pickingLocation && "pointer-events-none opacity-0",
          )}
          aria-hidden={pickingLocation}
        >
          <div className="pointer-events-auto flex w-full items-center gap-2 md:w-72 md:shrink-0 lg:w-80">
            <div className="min-w-0 flex-1">
              <MapSearch
                googlePlacesEnabled={googlePlacesSearchEnabled}
                onSelect={(target: SearchTarget) => {
                  // A new object every time, so choosing the same result twice
                  // still moves the map instead of being skipped as unchanged.
                  // A slug opens the place drawer, whose resolve flies once with
                  // the drawer offset — flying here too would centre the pin and
                  // then visibly shove it a second later.
                  if (!target.slug) {
                    setFlyTo({ lng: target.lng, lat: target.lat });
                  }
                  setSelectedId(null);
                  setPreview(null);
                  setSearchMarker(target.slug ? null : target);
                  void setSlug(target.slug ?? null);
                }}
              />
            </div>
            <div className="shrink-0 md:hidden">{account}</div>
          </div>

          {/* min-w-0 flex-1: on a wider screen this row shares its line with
            the search box, and without both the row sizes to its content and
            bleeds past the viewport instead of scrolling inside it. */}
          <div className="flex min-h-12 min-w-0 flex-1 items-center">
            <div className="pointer-events-auto flex h-12 min-w-0 flex-1 items-center">
              <CategoryChips
                selected={categoryIds}
                onChange={(next) =>
                  void setCategoryIds(next.length > 0 ? next : null)
                }
              />
            </div>
          </div>

          {/* Under the search row, where someone looks when the map stops
              loading. Renders nothing while the connection is fine. */}
          <div className="flex md:basis-full">
            <OfflineIndicator placement="map" />
          </div>
        </div>

        {!pickingLocation && (
          <>
            <MapActions
              concealed={slug !== null || selectedTraffic !== null}
              onAddPlace={() => startPicking("place")}
              onReportTraffic={() => startPicking("traffic")}
              onLocate={(position, accuracyMeters) => {
                setSearchMarker(null);
                setMyLocation({ ...position, accuracyMeters });
                setFlyTo(position);
              }}
            />

            <MapLayers
              communityControls={community.controls}
              mode={asViewMode(viewMode)}
              traffic={traffic}
              alerts={alerts}
              googlePlaces={googlePlaces}
              onModeChange={(next) =>
                void setViewMode(next === DEFAULT_VIEW_MODE ? null : next)
              }
              onTrafficChange={(next) => void setTraffic(next ? true : null)}
              // On by default, so the parameter is written when it is turned
              // *off* — the opposite of the others, and what keeps a plain link
              // to the map clean.
              onAlertsChange={(next) => void setAlerts(next ? null : false)}
              onGooglePlacesChange={(next) =>
                void setGooglePlaces(next ? true : null)
              }
            />
          </>
        )}

        {/* Never while a point is being chosen or a place is open: the offer
            waits for a moment when nothing else is being asked. It shows on a
            phone or a tablet only — see the component. */}
        <InstallSplash
          hidden={pickingLocation || slug !== null || trafficId !== null}
        />

        {community.panel}
        {pickingLocation && (
          <PickLocation
            extentMeters={extentMeters}
            onExtentChange={setExtentMeters}
            onAnchorChange={setTapped}
            aim={{ ...aim, zoom: viewport.zoom }}
            moving={mapMoving}
            purpose={pickPurpose}
            anchor={streetAnchor}
            shape={pickShape}
            onShapeChange={(shape) => {
              setPickShape(shape);
              // A road tapped for a stretch is not where a point goes.
              setTapped(null);
            }}
            onCancel={stopPicking}
            onDraftPathChange={setDraftPath}
            // "Centrarme" is navigation, so it lands at street level rather than
            // at the browse zoom the crosshair opened on.
            onCenter={(position) =>
              setFlyTo({
                ...position,
                zoom: Math.max(viewport.zoom, PICK_USABLE_ZOOM + 3),
                offset: crosshairOffset,
              })
            }
            onConfirm={(position, source, street) => {
              stopPicking();
              setDraftPath(null);
              setTapped(null);
              setHoverPoint(null);
              if (pickPurpose === "traffic") {
                setNewTraffic({
                  ...position,
                  shape: street ? "street" : "point",
                  extentMeters,
                  observedAt,
                  street,
                });
                return;
              }
              setNewPlace({ ...position, source });
            }}
          />
        )}

        <PlaceDrawer
          slug={slug}
          preview={preview}
          onResolved={handleResolved}
          onClose={close}
        />
        <AddPlaceDrawer
          place={newPlace}
          onClose={() => setNewPlace(null)}
          onPickAgain={() => pickAgain("place")}
        />
        <ReportTrafficDrawer
          point={newTraffic}
          onClose={() => setNewTraffic(null)}
          onPickAgain={() => pickAgain("traffic")}
          onReported={refreshTraffic}
        />
        <TrafficDrawer
          report={selectedTraffic}
          onClose={() => void setTrafficId(null)}
        />
      </div>
    </MapProvider>
  );
}
