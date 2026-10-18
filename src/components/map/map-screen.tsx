"use client";

import { useQuery } from "@tanstack/react-query";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { PlaceDetail } from "@/components/places/place-detail";
import { AccountMenu } from "@/components/shell/account-menu";
import { NotificationBell } from "@/components/shell/notification-bell";
import { TabBar } from "@/components/shell/tab-bar";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Link } from "@/i18n/navigation";
import { cx } from "@/lib/cx";
import { PROVINCE_BOUNDS } from "@/lib/map/config";
import { orpc } from "@/lib/orpc";
import { CategoryChips } from "./category-chips";
import { LocationLayer } from "./location-layer";
import { MapAttribution, MapControls } from "./map-controls";
import { MapCanvas, MapMarker } from "./map-core";
import { MapPanel } from "./map-panel";
import { MapSearch, type SearchPick } from "./map-search";
import { type MapPlace, PlaceMarkers } from "./place-markers";
import { ProvinceLayers } from "./province-layers";

/**
 * The map screen. What is open lives in the URL (`?lugar=`, `?reporte=`,
 * `?cat=`), so a view can be shared by pasting a link, survives the reload a
 * phone does when it drops signal, and closes with the back button.
 */
export function MapScreen() {
  const t = useTranslations("map");
  const tApp = useTranslations("app");
  const desktop = useMediaQuery("(min-width: 50.625rem)");
  const geo = useGeolocation();
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [slug, setSlug] = useQueryState(
    "lugar",
    parseAsString.withOptions({ history: "push" }),
  );
  const [categories, setCategories] = useQueryState(
    "cat",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [searchMarker, setSearchMarker] = useState<SearchPick | null>(null);
  const followFix = useRef(false);

  const categorySet = useMemo(() => new Set(categories), [categories]);
  const detail = useQuery({
    ...orpc.places.detail.queryOptions({ input: { slug: slug ?? "" } }),
    enabled: Boolean(slug),
  });

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

  // A place opened from a link, a notification or search is brought into view.
  const focusedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !detail.data || focusedSlug.current === detail.data.slug)
      return;
    focusedSlug.current = detail.data.slug;
    focus(detail.data.location.lng, detail.data.location.lat);
  }, [mapReady, detail.data, focus]);

  useEffect(() => {
    if (geo.state.status !== "tracking" || !followFix.current) return;
    followFix.current = false;
    focus(geo.state.fix.lng, geo.state.fix.lat, 15);
  }, [geo.state, focus]);

  const onLocate = () => {
    if (geo.state.status === "tracking") {
      focus(geo.state.fix.lng, geo.state.fix.lat, 15);
      return;
    }
    followFix.current = true;
    geo.start();
  };

  const onPick = (pick: SearchPick) => {
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

  const panelOpen = Boolean(slug);
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
        <PlaceMarkers
          categories={categorySet}
          selectedSlug={slug}
          selectedFallback={selectedFallback}
          onSelect={(place) => {
            focusedSlug.current = place.slug;
            void setSlug(place.slug);
            focus(place.lng, place.lat, mapRef.current?.getZoom());
          }}
        />
        {searchMarker ? (
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
              <span className="mt-1 size-3 rounded-full bg-ink ring-[3px] ring-card shadow-md" />
            </span>
          </MapMarker>
        ) : null}
        <LocationLayer
          fix={geo.state.status === "tracking" ? geo.state.fix : null}
        />

        {/* Top: search, account, categories. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 pt-[max(10px,env(safe-area-inset-top))] md:pt-4">
          <div className="flex items-start gap-3 px-3 md:px-4">
            <div className="pointer-events-auto flex w-full items-center gap-2 md:w-[400px] md:shrink-0">
              <Link
                href="/"
                aria-label={tApp("name")}
                className="press hidden shrink-0 rounded-[12px] md:block"
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
              onChange={(next) => void setCategories(next.length ? next : null)}
              className="pointer-events-auto hidden min-w-0 flex-1 md:flex"
            />
            <div className="pointer-events-auto glass hidden h-12 shrink-0 items-center gap-1 rounded-full px-1 md:flex">
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

        {/* Bottom right: the map's own controls. They step aside on a phone
            while a sheet covers that corner. */}
        <div
          className={cx(
            "pointer-events-none absolute right-3 bottom-[calc(var(--tabbar-h)+12px)] z-10 transition-[opacity,transform] duration-300 ease-out md:right-4 md:bottom-6",
            sheetCoversControls &&
              "pointer-events-none translate-y-2 opacity-0",
          )}
          aria-hidden={sheetCoversControls || undefined}
        >
          <MapControls
            geo={geo.state}
            onLocate={onLocate}
            onLayers={() => {}}
          />
        </div>
        <div
          className={cx(
            "pointer-events-none absolute bottom-[calc(var(--tabbar-h)+16px)] left-3 z-10 md:bottom-6",
            panelOpen && "md:left-[432px]",
            sheetCoversControls && "opacity-0",
          )}
        >
          <MapAttribution />
        </div>
      </MapCanvas>

      <MapPanel
        open={panelOpen}
        onClose={() => void setSlug(null)}
        title={detail.data?.name ?? t("placeTitle")}
        contentKey={slug ?? "none"}
      >
        {slug ? (
          <PlaceDetail
            slug={slug}
            onSelectNearby={(next) => {
              focusedSlug.current = null;
              void setSlug(next);
            }}
          />
        ) : null}
      </MapPanel>

      <TabBar />
    </div>
  );
}
