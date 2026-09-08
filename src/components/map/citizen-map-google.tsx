"use client";

import { useQuery } from "@tanstack/react-query";
import { Map as GoogleMap, useMap } from "@vis.gl/react-google-maps";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { publicEnv } from "@/lib/env.public";
import {
  COUNTRY_BOUNDS,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PLACE_LABEL_ZOOM,
  REGION_CENTER,
} from "@/lib/map/config";
import { googleMapStyle } from "@/lib/map/google-style";
import {
  alertPin,
  alertSize,
  labelInk,
  markerPin,
  markerSize,
} from "@/lib/map/marker-pin";
import { STREET_SELECTION, trafficColor } from "@/lib/map/traffic-colors";
import { DEFAULT_VIEW_MODE, googleMapTypeFor } from "@/lib/map/view-mode";
import { offsetCenter } from "@/lib/map/viewport";
import { GoogleMarker } from "./google-marker";
import { GooglePolyline } from "./google-polyline";
import { LocationMarker } from "./location-marker";
import { StreetSelection } from "./street-selection";
import type { CitizenMapProps } from "./types";

const MAP_ID = "ruta-cibao";

/** One size for every pin; selection scales it in CSS so the change eases. */
const PIN_SIZE = markerSize(false);

type PlaceFeature = {
  properties: {
    id: string;
    slug: string;
    name: string;
    category: string;
    color: string;
    icon: string;
  };
  geometry: { coordinates: [number, number] };
};

/**
 * Live traffic on the roads.
 *
 * Google renders it as green through red along each road, which is the fastest
 * way for someone to see whether a route is moving — and it sits directly
 * alongside the traffic citizens report themselves, which is what this platform
 * adds on top: an official layer says a road is slow, a citizen says why.
 *
 * The library exposes no component for it, so it is attached to the map
 * imperatively and detached on unmount, which is what stops a second layer
 * being added every time the toggle flips.
 */
function TrafficLayer({ enabled }: { enabled: boolean }) {
  const map = useMap(MAP_ID);

  useEffect(() => {
    if (!map || !enabled) return;

    const layer = new google.maps.TrafficLayer();
    layer.setMap(map);

    return () => layer.setMap(null);
  }, [map, enabled]);

  return null;
}

/** Moves the map when a search result asks it to, without remounting it. */
function MapController({ flyTo }: { flyTo: CitizenMapProps["flyTo"] }) {
  const map = useMap(MAP_ID);

  useEffect(() => {
    if (!map || !flyTo) return;

    const zoom = flyTo.zoom ?? 16;
    // The centre is solved for at the zoom the map is about to be at, rather
    // than nudged with `panBy` afterwards: `panBy` moves by pixels at whatever
    // scale is rendering at that instant, which right after a zoom change is
    // still the old one — a drawer's worth of pixels at the region zoom is a
    // hundred kilometres of ground.
    const centre = flyTo.offset
      ? offsetCenter(flyTo, zoom, flyTo.offset)
      : { lng: flyTo.lng, lat: flyTo.lat };

    map.setZoom(zoom);
    map.panTo({ lat: centre.lat, lng: centre.lng });
  }, [map, flyTo]);

  return null;
}

/**
 * The map, on Google.
 *
 * One of three renderers kept side by side while the choice is open. This one
 * is familiar and reliable; what it costs is a bill per map load that the
 * municipality would inherit, and an offline map, since Google's terms forbid
 * caching tiles.
 *
 * The places come from the same GeoJSON endpoint every renderer reads, so
 * switching between them changes only what draws the points, never where they
 * come from.
 */
export function CitizenMapGoogle({
  communityFeatures = [],
  onSelectCommunity,
  selectedId,
  categoryIds,
  flyTo,
  searchMarker,
  traffic = false,
  trafficReports = [],
  selectedTrafficId = null,
  onSelectTraffic,
  viewMode = DEFAULT_VIEW_MODE,
  googlePlaces = false,
  myLocation = null,
  pickingLocation = false,
  draftPath = null,
  draftAnchor = null,
  hoverPath = null,
  onMapPoint,
  onHoverPoint,
  onViewportChange,
  onMovingChange,
  onSelect,
}: CitizenMapProps) {
  const { data } = useQuery({
    queryKey: ["places", "geojson"],
    queryFn: async (): Promise<{ features: PlaceFeature[] }> => {
      const response = await fetch("/api/places/geojson");
      if (!response.ok) throw new Error(`places responded ${response.status}`);
      return response.json();
    },
  });

  /**
   * Whether the pins are close enough together to be named.
   *
   * A boolean rather than the zoom itself: this re-renders every marker when it
   * changes, and the map crosses a dozen fractional zoom levels in one pinch.
   */
  const [named, setNamed] = useState(DEFAULT_ZOOM >= PLACE_LABEL_ZOOM);

  const locationLabel = useTranslations("map.actions")("here");
  const key = publicEnv.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!key) {
    return (
      <div className="flex size-full items-center justify-center p-6 text-center text-muted-foreground text-sm">
        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set.
      </div>
    );
  }

  const visible = (data?.features ?? []).filter(
    // An empty selection means everything, not nothing.
    (feature) =>
      categoryIds.length === 0 ||
      categoryIds.includes(feature.properties.category),
  );
  const searchMarkerSize = markerSize(true);

  return (
    <GoogleMap
      id={MAP_ID}
      className="size-full"
      defaultCenter={{
        lat: REGION_CENTER.latitude,
        lng: REGION_CENTER.longitude,
      }}
      defaultZoom={DEFAULT_ZOOM}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // `strictBounds` restricts the viewport, not just its centre, so zooming
      // out stops at the country instead of framing the neighbouring one. The
      // strip of Haiti along the border stays: the border is not a meridian.
      restriction={{
        latLngBounds: {
          west: COUNTRY_BOUNDS[0],
          south: COUNTRY_BOUNDS[1],
          east: COUNTRY_BOUNDS[2],
          north: COUNTRY_BOUNDS[3],
        },
        strictBounds: true,
      }}
      mapTypeId={googleMapTypeFor(viewMode)}
      // No Map ID on purpose: one would make Google ignore this style, and
      // the style is the only way to clear its own listings off the map. The
      // markers are `OverlayView` elements for the same reason — see
      // `google-marker.tsx`.
      styles={googleMapStyle(googlePlaces)}
      disableDefaultUI
      zoomControl
      gestureHandling="greedy"
      clickableIcons={false}
      onIdle={(event) => {
        const center = event.map.getCenter();
        onMovingChange?.(false);
        setNamed((event.map.getZoom() ?? DEFAULT_ZOOM) >= PLACE_LABEL_ZOOM);
        if (center) {
          onViewportChange?.({
            lng: center.lng(),
            lat: center.lat(),
            zoom: event.map.getZoom() ?? DEFAULT_ZOOM,
            bounds: event.map.getBounds()?.toJSON(),
          });
        }
      }}
      onDragstart={() => onMovingChange?.(true)}
      onZoomChanged={(event) => {
        onMovingChange?.(true);
        // During the pinch as well as after it: names that appeared only once
        // the map settled would read as a second thing loading.
        setNamed((event.map.getZoom() ?? DEFAULT_ZOOM) >= PLACE_LABEL_ZOOM);
      }}
      // While the crosshair is out a tap means "that road there", which is the
      // most direct way to say it and needs no explaining on a phone.
      // Otherwise a tap on empty ground closes whatever was open, which is what
      // people expect from a map and saves them hunting for a close button.
      onClick={(event) => {
        const point = event.detail.latLng;
        if (pickingLocation) {
          if (point) onMapPoint?.({ lng: point.lng, lat: point.lat });
          return;
        }
        onSelect(null);
        onSelectTraffic?.(null);
      }}
      // Only while choosing: a pointer moving over the map at any other time is
      // somebody reading it, and asking a road service about every pixel they
      // pass over would be both wasteful and rude.
      onMousemove={
        pickingLocation && onHoverPoint
          ? (event) => {
              const point = event.detail.latLng;
              onHoverPoint(point ? { lng: point.lng, lat: point.lat } : null);
            }
          : undefined
      }
      onMouseout={pickingLocation ? () => onHoverPoint?.(null) : undefined}
    >
      {visible.map((feature) => {
        const { id, slug, name, category, color, icon } = feature.properties;
        const isSelected = id === selectedId;

        return (
          <GoogleMarker
            key={id}
            mapId={MAP_ID}
            position={{
              lat: feature.geometry.coordinates[1],
              lng: feature.geometry.coordinates[0],
            }}
            title={name}
            selected={isSelected}
            zIndex={isSelected ? 2 : 1}
            // The name in the category's own colour, the way Google labels its
            // own listings: the pin says where and what, the word says which.
            // Only from close in — see `PLACE_LABEL_ZOOM`.
            label={
              named ? (
                <span
                  className="map-place-label"
                  style={{ color: labelInk(color) }}
                >
                  {name}
                </span>
              ) : undefined
            }
            onClick={() => {
              if (!pickingLocation) {
                onSelect({ id, slug, name, categoryId: category });
              }
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: a map pin is not a
                content image; next/image would add a layout box and a loader
                around a 1 KB data URI that is already in memory. */}
            <img
              src={markerPin(color, icon, false)}
              width={PIN_SIZE.width}
              height={PIN_SIZE.height}
              alt=""
              draggable={false}
              className="block select-none"
            />
          </GoogleMarker>
        );
      })}

      {/* The road itself, under the markers: a stretch is the shape of the
          problem, and the pin on top of it is where to tap. */}
      {communityFeatures.map((feature) => (
        <GoogleMarker
          key={`community-${feature.kind}-${feature.id}`}
          mapId={MAP_ID}
          position={{ lng: feature.lng, lat: feature.lat }}
          title={feature.title}
          zIndex={4}
          onClick={() => {
            if (!pickingLocation) onSelectCommunity?.(feature);
          }}
        >
          <span
            className="flex max-w-44 items-center gap-1.5 rounded-full border-2 bg-background px-3 py-2 text-xs font-semibold shadow-sm"
            style={{ borderColor: feature.color }}
          >
            <span aria-hidden>{feature.kind === "route" ? "↝" : "!"}</span>
            <span className="truncate">{feature.title}</span>
          </span>
        </GoogleMarker>
      ))}
      {communityFeatures.map(
        (feature) =>
          feature.path && (
            <GooglePolyline
              key={`community-path-${feature.id}`}
              mapId={MAP_ID}
              path={feature.path}
              color={feature.color}
              weight={5}
              onClick={() => {
                if (!pickingLocation) onSelectCommunity?.(feature);
              }}
            />
          ),
      )}
      {trafficReports.map((report) =>
        report.path && report.path.length > 1 ? (
          <GooglePolyline
            key={`path-${report.id}`}
            mapId={MAP_ID}
            path={report.path}
            // The road's colour is what it costs a driver — red, amber, yellow,
            // green — not the category's own chip colour, which is about
            // telling categories apart in a list.
            color={trafficColor(report.state, report.severity)}
            zIndex={report.id === selectedTrafficId ? 12 : 10}
            onClick={() => {
              if (!pickingLocation) onSelectTraffic?.(report.id);
            }}
          />
        ) : null,
      )}

      {/* The road under the pointer, faint: an offer, not a choice. It sits
          under the chosen one so moving off a selected street does not appear
          to unselect it. */}
      {hoverPath && hoverPath.length > 1 && (
        <GooglePolyline
          mapId={MAP_ID}
          path={hoverPath}
          color={STREET_SELECTION.hover}
          weight={8}
          opacity={0.45}
          zIndex={18}
        />
      )}

      {/* The chosen stretch, in the interface's ink with a cap at each end:
          a selection laid over the map, heavier than any reported road and
          in no traffic colour, because nothing has been said about it yet. */}
      {draftPath && draftPath.length > 1 && (
        <StreetSelection mapId={MAP_ID} path={draftPath} anchor={draftAnchor} />
      )}

      {/* Above the place pins: a road that is closed right now outranks a
          restaurant that has been there for years. */}
      {trafficReports.map((report) => {
        // A cleared road is information, not something to act on: it keeps its
        // green line and loses its marker, so the map stops asking about it.
        if (report.state === "cleared") return null;

        const isSelected = report.id === selectedTrafficId;
        const size = alertSize(isSelected);

        return (
          <GoogleMarker
            key={report.id}
            mapId={MAP_ID}
            position={{ lat: report.lat, lng: report.lng }}
            anchor="center"
            title={report.categoryName}
            selected={isSelected}
            zIndex={isSelected ? 6 : 5}
            onClick={() => {
              if (!pickingLocation) onSelectTraffic?.(report.id);
            }}
          >
            {/* biome-ignore lint/performance/noImgElement: see above. */}
            <img
              src={alertPin(
                report.categoryColor,
                report.categoryIcon,
                isSelected,
              )}
              width={size.width}
              height={size.height}
              alt=""
              draggable={false}
              className="block select-none"
            />
          </GoogleMarker>
        );
      })}

      {myLocation && (
        // Not shaped like a place pin: the person is not a place, and giving
        // them the same shape as a hospital would put them in its class. Real
        // DOM rather than a data URI, because signed in it carries the account
        // photo — see `location-marker`.
        <GoogleMarker
          mapId={MAP_ID}
          position={{ lat: myLocation.lat, lng: myLocation.lng }}
          anchor="center"
          title={locationLabel}
          zIndex={3}
        >
          <LocationMarker />
        </GoogleMarker>
      )}

      {searchMarker && (
        <GoogleMarker
          mapId={MAP_ID}
          position={{ lat: searchMarker.lat, lng: searchMarker.lng }}
          title={searchMarker.label}
          zIndex={4}
        >
          {/* biome-ignore lint/performance/noImgElement: see above. */}
          <img
            src={markerPin("#2563eb", "map-pin", true)}
            width={searchMarkerSize.width}
            height={searchMarkerSize.height}
            alt=""
            draggable={false}
            className="block select-none"
          />
        </GoogleMarker>
      )}

      <TrafficLayer enabled={traffic} />
      <MapController flyTo={flyTo} />
    </GoogleMap>
  );
}
