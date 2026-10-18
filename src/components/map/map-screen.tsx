"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Footprints,
  MapPinPlus,
  MessageSquarePlus,
  Plus,
  TrafficCone,
} from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-context";
import { LogoMark } from "@/components/brand/logo";
import { AddPlace } from "@/components/places/add-place";
import { PlaceDetail } from "@/components/places/place-detail";
import { AccountMenu } from "@/components/shell/account-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { TabBar } from "@/components/shell/tab-bar";
import { ReportTraffic } from "@/components/traffic/report-traffic";
import { TrafficDetail } from "@/components/traffic/traffic-detail";
import {
  TrafficLayer,
  type TrafficReport,
} from "@/components/traffic/traffic-layer";
import { Menu, MenuItem } from "@/components/ui/menu";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link, useRouter } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { orpc } from "@/lib/orpc";
import { CategoryChips } from "./category-chips";
import { CommunityLayer } from "./community-layer";
import { DEFAULT_LAYERS, LayersSheet, type MapLayers } from "./layers-sheet";
import { LocationLayer } from "./location-layer";
import { MapAttribution, MapControls } from "./map-controls";
import { MapCanvas, MapMarker } from "./map-core";
import { MapPanel } from "./map-panel";
import { MapSearch, type SearchPick } from "./map-search";
import { type MapPlace, PlaceMarkers } from "./place-markers";
import { ProvinceLayers } from "./province-layers";

const LAYERS_KEY = "ruta-cibao:map-layers";
const FLOWS = ["transito", "lugar"] as const;

function useStoredLayers() {
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAYERS_KEY);
      if (stored)
        setLayers({
          ...DEFAULT_LAYERS,
          ...(JSON.parse(stored) as Partial<MapLayers>),
        });
    } catch {
      // Storage can be unavailable; the defaults are a complete answer.
    }
  }, []);
  const update = (next: MapLayers) => {
    setLayers(next);
    try {
      localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
    } catch {
      // Same: a convenience, not state anyone depends on.
    }
  };
  return [layers, update] as const;
}

/**
 * The map screen. What is open lives in the URL (`?lugar=`, `?reporte=`,
 * `?cat=`, `?reportar=`), so a view can be shared by pasting a link, survives
 * the reload a phone does when it drops signal, and closes with the back
 * button.
 */
export function MapScreen() {
  const t = useTranslations("map");
  const tApp = useTranslations("app");
  const desktop = useMediaQuery("(min-width: 50.625rem)");
  const geo = useGeolocation();
  const router = useRouter();
  const { viewer, isSignedIn, isLoading: authLoading } = useAuth();
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [slug, setSlug] = useQueryState(
    "lugar",
    parseAsString.withOptions({ history: "push" }),
  );
  const [reportId, setReportId] = useQueryState(
    "reporte",
    parseAsString.withOptions({ history: "push" }),
  );
  const [flow, setFlow] = useQueryState(
    "reportar",
    parseAsStringLiteral(FLOWS).withOptions({ history: "push" }),
  );
  const [categories, setCategories] = useQueryState(
    "cat",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [layers, setLayers] = useStoredLayers();
  const [layersOpen, setLayersOpen] = useState(false);
  const [searchMarker, setSearchMarker] = useState<SearchPick | null>(null);
  const [inView, setInView] = useState<TrafficReport[]>([]);
  const followFix = useRef(false);

  const categorySet = useMemo(() => new Set(categories), [categories]);
  const detail = useQuery({
    ...orpc.places.detail.queryOptions({ input: { slug: slug ?? "" } }),
    enabled: Boolean(slug),
  });

  // A report opened from a link or a notification may be anywhere in the
  // province, not in the viewport the layer last fetched.
  const provinceTraffic = useQuery({
    ...orpc.traffic.active.queryOptions({
      input: {
        west: PROVINCE_BOUNDS[0],
        south: PROVINCE_BOUNDS[1],
        east: PROVINCE_BOUNDS[2],
        north: PROVINCE_BOUNDS[3],
        limit: 200,
      },
    }),
    enabled: Boolean(reportId) && !inView.some((item) => item.id === reportId),
  });
  const openReport = reportId
    ? (inView.find((item) => item.id === reportId) ??
      provinceTraffic.data?.find((item) => item.id === reportId) ??
      null)
    : null;

  const selectedFallback: MapPlace | null =
    slug && detail.data
      ? {
          kind: "place",
          id: detail.data.id,
          slug: detail.data.slug,
          name: detail.data.name,
          categoryId: detail.data.category.id,
          color: detail.data.category.color,
          icon: detail.data.category.icon,
          lng: detail.data.location.lng,
          lat: detail.data.location.lat,
        }
      : null;

  /** Moves the camera so a point sits clear of whatever covers the map. */
  const focus = useCallback(
    (lng: number, lat: number, zoom?: number) => {
      const map = mapRef.current;
      if (!map) return;
      const height = map.getContainer().clientHeight;
      map.easeTo({
        center: [lng, lat],
        zoom: zoom ?? Math.max(map.getZoom(), 14.5),
        duration: 650,
        padding: desktop
          ? { left: 432, top: 24, right: 24, bottom: 24 }
          : {
              top: 120,
              bottom: Math.min(340, height * 0.42),
              left: 16,
              right: 16,
            },
      });
    },
    [desktop],
  );

  const focusedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !detail.data || focusedSlug.current === detail.data.slug)
      return;
    focusedSlug.current = detail.data.slug;
    focus(detail.data.location.lng, detail.data.location.lat);
  }, [mapReady, detail.data, focus]);

  const focusedReport = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !openReport || focusedReport.current === openReport.id)
      return;
    focusedReport.current = openReport.id;
    focus(openReport.lng, openReport.lat);
  }, [mapReady, openReport, focus]);

  useEffect(() => {
    if (geo.state.status !== "tracking" || !followFix.current) return;
    followFix.current = false;
    focus(geo.state.fix.lng, geo.state.fix.lat, 15);
  }, [geo.state, focus]);

  // Reporting needs an account: a link or shortcut straight into a flow goes
  // through sign-in first and comes back to it.
  useEffect(() => {
    if (!flow || authLoading || isSignedIn) return;
    router.replace(
      `/entrar?callbackUrl=${encodeURIComponent(`/mapa?reportar=${flow}`)}` as "/entrar",
    );
  }, [flow, authLoading, isSignedIn, router]);

  const onLocate = () => {
    if (geo.state.status === "tracking") {
      focus(geo.state.fix.lng, geo.state.fix.lat, 15);
      return;
    }
    followFix.current = true;
    geo.start();
  };

  const onPick = (pick: SearchPick) => {
    void setReportId(null);
    if (pick.kind === "place") {
      setSearchMarker(null);
      focusedSlug.current = null;
      void setSlug(pick.slug);
    } else {
      setSearchMarker(pick);
      void setSlug(null);
      focus(pick.lng, pick.lat, 16);
    }
  };

  const startFlow = (next: (typeof FLOWS)[number]) => {
    void setSlug(null);
    void setReportId(null);
    void setFlow(next);
    const map = mapRef.current;
    if (next === "transito" && map && map.getZoom() < 13.5) {
      const center =
        geo.state.status === "tracking"
          ? ([geo.state.fix.lng, geo.state.fix.lat] as [number, number])
          : map.getCenter();
      map.easeTo({ center, zoom: 14.5, duration: 600 });
    }
  };

  const picking = Boolean(flow) && isSignedIn;

  // A flow opened from a link or the app shortcut starts on the province
  // overview, where no street can be chosen. Start in the person's own
  // municipality instead (or the provincial capital), close enough to pick.
  const municipalities = useQuery({
    ...orpc.municipalities.list.queryOptions(),
    enabled: picking,
  });
  const placedFlow = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (
      !picking ||
      !mapReady ||
      !map ||
      placedFlow.current ||
      !municipalities.data
    )
      return;
    placedFlow.current = true;
    if (map.getZoom() >= 12) return;
    const home =
      municipalities.data.find((item) => item.id === viewer?.municipalityId) ??
      municipalities.data.find((item) => item.id === "sabaneta") ??
      municipalities.data[0];
    if (home?.center)
      map.jumpTo({ center: [home.center.lng, home.center.lat], zoom: 12 });
  }, [picking, mapReady, municipalities.data, viewer?.municipalityId]);
  useEffect(() => {
    if (!picking) placedFlow.current = false;
  }, [picking]);
  const panelOpen = !picking && (Boolean(slug) || Boolean(openReport));
  const sheetCoversControls = panelOpen && !desktop;

  return (
    <div className="fixed inset-0 overflow-hidden bg-paper-2">
      <h1 className="sr-only">{t("title")}</h1>
      <MapCanvas
        label={t("title")}
        bounds={PROVINCE_BOUNDS}
        padding={{ top: 140, bottom: 110, left: 24, right: 24 }}
        className="absolute inset-0"
        onReady={(map) => {
          mapRef.current = map;
          setMapReady(true);
        }}
      >
        <ProvinceLayers />
        <CommunityLayer
          showRoutes={layers.routes && !picking}
          showCases={layers.cases && !picking}
        />
        {layers.traffic ? (
          <TrafficLayer
            selectedId={openReport?.id ?? null}
            onData={setInView}
            onSelect={(next) => {
              focusedReport.current = next.id;
              void setSlug(null);
              void setReportId(next.id);
            }}
          />
        ) : null}
        {picking ? null : (
          <PlaceMarkers
            categories={categorySet}
            selectedSlug={slug}
            selectedFallback={selectedFallback}
            onSelect={(place) => {
              focusedSlug.current = place.slug;
              void setReportId(null);
              void setSlug(place.slug);
              focus(place.lng, place.lat, mapRef.current?.getZoom());
            }}
          />
        )}
        {searchMarker && !picking ? (
          <MapMarker
            lngLat={[searchMarker.lng, searchMarker.lat]}
            anchor="bottom"
            zIndex={15}
          >
            <span
              className="map-pop flex flex-col items-center"
              role="img"
              aria-label={searchMarker.name}
            >
              <span className="glass max-w-48 truncate rounded-full px-2.5 py-1 text-[12px] font-medium text-ink">
                {searchMarker.name}
              </span>
              <span className="mt-1 size-3 rounded-full bg-ink shadow-md ring-[3px] ring-card" />
            </span>
          </MapMarker>
        ) : null}
        <LocationLayer
          fix={geo.state.status === "tracking" ? geo.state.fix : null}
        />

        {picking && flow === "transito" ? (
          <ReportTraffic
            onDone={() => void setFlow(null)}
            onCancel={() => void setFlow(null)}
          />
        ) : null}
        {picking && flow === "lugar" ? (
          <AddPlace
            onDone={() => void setFlow(null)}
            onCancel={() => void setFlow(null)}
          />
        ) : null}

        {/* Top: search, account, categories. */}
        {picking ? null : (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-[max(10px,env(safe-area-inset-top))] md:pt-4">
            <div className="flex items-start gap-3 px-3 md:px-4">
              <div className="pointer-events-auto flex w-full items-center gap-2 md:w-[400px] md:shrink-0">
                <Link
                  href="/"
                  aria-label={tApp("name")}
                  className="press hidden shrink-0 rounded-[14px] md:block"
                >
                  <LogoMark className="size-12 rounded-[14px] shadow-sm" />
                </Link>
                <MapSearch
                  onPick={onPick}
                  className="min-w-0 flex-1"
                  trailing={desktop ? null : <AccountMenu />}
                />
              </div>
              <CategoryChips
                selected={categories}
                onChange={(next) =>
                  void setCategories(next.length ? next : null)
                }
                className="pointer-events-auto hidden min-w-0 flex-1 md:flex"
              />
              <div className="glass pointer-events-auto hidden h-12 shrink-0 items-center gap-1 rounded-full px-1 md:flex">
                <NotificationBell />
                <AccountMenu />
              </div>
            </div>
            <CategoryChips
              selected={categories}
              onChange={(next) => void setCategories(next.length ? next : null)}
              className="pointer-events-auto mt-2 md:hidden"
            />
          </div>
        )}

        {/* Bottom right: contribute, then the map's own controls. They step
            aside on a phone while a sheet covers that corner. */}
        <div
          className={cx(
            "pointer-events-none absolute right-3 bottom-[calc(var(--tabbar-h)+12px)] z-10 flex flex-col items-end gap-3 transition-[opacity,transform] duration-300 ease-out md:right-4 md:bottom-6",
            (sheetCoversControls || (picking && !desktop)) &&
              "translate-y-2 opacity-0 [&_*]:pointer-events-none",
          )}
          aria-hidden={sheetCoversControls || undefined}
        >
          <MapControls
            geo={geo.state}
            onLocate={onLocate}
            onLayers={() => setLayersOpen(true)}
          />
          {picking ? null : (
            <div className="pointer-events-auto">
              <Menu
                side="top"
                align="end"
                trigger={
                  <button
                    type="button"
                    className="press flex h-12 items-center gap-2 rounded-full bg-accent pr-5 pl-4 text-[15px] font-medium text-on-accent shadow-lg hover:bg-accent-hover"
                  >
                    <Plus strokeWidth={2} className="size-5" />
                    {t("contribute.label")}
                  </button>
                }
              >
                <MenuItem onClick={() => startFlow("transito")}>
                  <TrafficCone strokeWidth={1.5} />
                  {t("contribute.traffic")}
                </MenuItem>
                <MenuItem onClick={() => startFlow("lugar")}>
                  <MapPinPlus strokeWidth={1.5} />
                  {t("contribute.place")}
                </MenuItem>
                <MenuItem onClick={() => router.push("/rutas?proponer=1")}>
                  <Footprints strokeWidth={1.5} />
                  {t("contribute.route")}
                </MenuItem>
                <MenuItem onClick={() => router.push("/consultas?abrir=1")}>
                  <MessageSquarePlus strokeWidth={1.5} />
                  {t("contribute.case")}
                </MenuItem>
              </Menu>
            </div>
          )}
        </div>
        <div
          className={cx(
            "pointer-events-none absolute bottom-[calc(var(--tabbar-h)+16px)] left-3 z-10 transition-opacity md:bottom-6 md:left-4",
            panelOpen && "md:left-[432px]",
            (sheetCoversControls || picking) &&
              "opacity-0 [&_*]:pointer-events-none",
          )}
        >
          <MapAttribution />
        </div>
      </MapCanvas>

      <MapPanel
        open={panelOpen}
        onClose={() => {
          void setSlug(null);
          void setReportId(null);
        }}
        title={
          openReport
            ? openReport.categoryName
            : (detail.data?.name ?? t("placeTitle"))
        }
        contentKey={openReport ? `report-${openReport.id}` : (slug ?? "none")}
      >
        {openReport ? (
          <TrafficDetail report={openReport} />
        ) : slug ? (
          <PlaceDetail
            slug={slug}
            onSelectNearby={(next) => {
              focusedSlug.current = null;
              void setSlug(next);
            }}
          />
        ) : null}
      </MapPanel>

      <LayersSheet
        open={layersOpen}
        onOpenChange={setLayersOpen}
        layers={layers}
        onChange={setLayers}
      />

      {picking ? null : <TabBar />}
    </div>
  );
}
