"use client";

import type * as LeafletTypes from "leaflet";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useBoundaries } from "@/hooks/use-boundaries";
import { publicEnv } from "@/lib/env.public";
import { RASTER_BASEMAP } from "@/lib/map/basemap";
import {
  COUNTRY_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  PLACE_LABEL_ZOOM,
  PROVINCE_BOUNDS,
} from "@/lib/map/config";
import { MIN_ACCURACY_RING_M } from "@/lib/map/location";
import { labelInk, markerPin, markerSize } from "@/lib/map/marker-pin";
import { mapPalette } from "@/lib/map/palette";
import {
  mapOverlays,
  OVERLAY_COMPACT_CLASS,
  overlayChip,
} from "./overlay-features";
import type { CitizenMapProps } from "./types";

/** The properties every feature from `/api/places/geojson` carries. */
type PlaceProperties = {
  id: string;
  slug: string;
  name: string;
  category: string;
  color: string;
  icon: string;
};

/** Leaflet types the properties as `any`; this names what is actually there. */
function propertiesOf(
  feature: { properties?: unknown } | undefined,
): PlaceProperties | null {
  const properties = feature?.properties as PlaceProperties | undefined;
  return properties?.id ? properties : null;
}

/**
 * The map.
 *
 * Leaflet, driven imperatively against a container ref. The library is loaded
 * with a dynamic `import()` inside the effect rather than through a lazily
 * mounted component: Leaflet touches `window` at module scope, so it cannot be
 * imported on the server, and wrapping the whole component in a lazy boundary
 * meant that when its chunk failed to arrive nothing rendered at all — not even
 * the container. This way the container is always in the DOM and only the
 * library arrives late.
 *
 * Everything the map decides — the basemap URL, the bounds, the palette —
 * comes from `@/lib/map`, which is plain data with no React and no DOM in it.
 * That is the seam a React Native build comes in at.
 */
export function CitizenMap({
  communityFeatures,
  onSelectCommunity,
  trafficReports,
  onSelectTraffic,
  draftPath,
  hoverPath,
  onMapPoint,
  selectedId,
  categoryIds,
  flyTo,
  searchMarker,
  myLocation = null,
  controllerRef,
  pickingLocation = false,
  onViewportChange,
  onMovingChange,
  onSelect,
}: CitizenMapProps) {
  const t = useTranslations("map.place");
  const mapT = useTranslations("map.accessibility");
  const labels = useRef({
    title: mapT("title"),
    zoomIn: mapT("zoomIn"),
    zoomOut: mapT("zoomOut"),
  });
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletTypes.Map | null>(null);
  const layer = useRef<LeafletTypes.GeoJSON | null>(null);
  const searchLayer = useRef<LeafletTypes.Marker | null>(null);
  const leaflet = useRef<typeof LeafletTypes | null>(null);

  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const { data: boundaries } = useBoundaries();
  const pointRef = useRef(onMapPoint);
  pointRef.current = onMapPoint;

  // Held in refs so a new handler never tears the map down and rebuilds it,
  // which would lose the viewport someone had panned to.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onMovingChangeRef = useRef(onMovingChange);
  onMovingChangeRef.current = onMovingChange;
  const pickingLocationRef = useRef(pickingLocation);
  pickingLocationRef.current = pickingLocation;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!container.current || map.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !container.current) return;

      leaflet.current = L;

      const instance = L.map(container.current, {
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // This is a provincial platform: panning to Santo Domingo to find an
        // empty map is worse than gently declining to go there.
        maxBounds: L.latLngBounds(
          [COUNTRY_BOUNDS[1], COUNTRY_BOUNDS[0]],
          [COUNTRY_BOUNDS[3], COUNTRY_BOUNDS[2]],
        ),
        maxBoundsViscosity: 0.8,
        zoomControl: false,
        attributionControl: false,
      });

      instance.fitBounds(
        [
          [PROVINCE_BOUNDS[1], PROVINCE_BOUNDS[0]],
          [PROVINCE_BOUNDS[3], PROVINCE_BOUNDS[2]],
        ],
        { paddingTopLeft: [24, 132], paddingBottomRight: [24, 72] },
      );
      L.tileLayer(publicEnv.NEXT_PUBLIC_RASTER_TILE_URL ?? RASTER_BASEMAP.url, {
        attribution:
          publicEnv.NEXT_PUBLIC_RASTER_TILE_ATTRIBUTION ??
          RASTER_BASEMAP.attribution,
        maxZoom: RASTER_BASEMAP.maxZoom,
      }).addTo(instance);

      instance.getContainer().setAttribute("role", "region");
      instance.getContainer().setAttribute("aria-label", labels.current.title);
      L.control.attribution({ prefix: false }).addTo(instance);

      // A tap on empty ground closes whatever was open, which is what people
      // expect from a map and saves them hunting for a close button.
      instance.on("click", (event) => {
        if (pickingLocationRef.current)
          pointRef.current?.({ lng: event.latlng.lng, lat: event.latlng.lat });
        if (!pickingLocationRef.current) onSelectRef.current(null);
      });

      // Names only from close in — see `PLACE_LABEL_ZOOM`. A class on the
      // container rather than unbinding every tooltip: the labels come and go
      // on every pinch, and rebuilding fifty of them each time is work the
      // stylesheet does for free.
      const showLabels = () => {
        const far = instance.getZoom() < PLACE_LABEL_ZOOM;
        instance.getContainer().classList.toggle("map-labels-hidden", far);
        instance.getContainer().classList.toggle(OVERLAY_COMPACT_CLASS, far);
      };
      showLabels();
      instance.on("zoomend", showLabels);

      instance.on("movestart", () => onMovingChangeRef.current?.(true));
      instance.on("moveend", () => {
        const center = instance.getCenter();
        onMovingChangeRef.current?.(false);
        onViewportChangeRef.current?.({
          lng: center.lng,
          lat: center.lat,
          zoom: instance.getZoom(),
          bounds: {
            west: instance.getBounds().getWest(),
            east: instance.getBounds().getEast(),
            south: instance.getBounds().getSouth(),
            north: instance.getBounds().getNorth(),
          },
        });
      });

      map.current = instance;
      const initialCenter = instance.getCenter();
      onViewportChangeRef.current?.({
        lng: initialCenter.lng,
        lat: initialCenter.lat,
        zoom: instance.getZoom(),
      });

      try {
        const response = await fetch("/api/places/geojson");
        if (!response.ok)
          throw new Error(`places responded ${response.status}`);
        const collection = await response.json();
        if (cancelled) return;

        layer.current = L.geoJSON(collection, {
          pointToLayer: (feature, latlng) => {
            const properties = propertiesOf(feature);
            const isSelected = properties?.id === selectedRef.current;

            const size = markerSize(isSelected);
            return L.marker(latlng, {
              title: properties?.name ?? labels.current.title,
              alt: properties?.name ?? labels.current.title,
              icon: L.icon({
                iconUrl: markerPin(
                  properties?.color || mapPalette.ink,
                  properties?.icon,
                  isSelected,
                ),
                iconSize: [size.width, size.height],
                iconAnchor: [size.width / 2, size.height],
              }),
            });
          },
          onEachFeature: (feature, marker) => {
            const properties = propertiesOf(feature);
            if (!properties) return;

            marker.on("click", (event) => {
              // Otherwise the map's own click handler closes it again.
              L.DomEvent.stopPropagation(event);
              if (!pickingLocationRef.current) {
                onSelectRef.current({
                  id: properties.id,
                  slug: properties.slug,
                  name: properties.name,
                  categoryId: properties.category,
                });
              }
            });
            // The name under the pin, in the category's colour with a white
            // ring around the letters — the same label the other two renderers
            // draw. An element rather than a string so the colour can be set
            // per place without building markup out of a name somebody typed.
            const label = document.createElement("span");
            label.className = "map-place-label";
            label.textContent = properties.name;
            label.style.color = labelInk(properties.color || mapPalette.ink);

            marker.bindTooltip(label, {
              permanent: true,
              direction: "bottom",
              offset: [0, 2],
              className: "map-place-tooltip",
              opacity: 1,
            });
          },
        }).addTo(instance);
        setReady(true);
      } catch (error) {
        console.error("could not load places", error);
        if (!cancelled) setReady(true);
        if (!cancelled) setFailed(true);
      }
    })().catch((error) => {
      console.error("could not start the map", error);
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      setReady(false);
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  /** Redraws the markers, rather than rebuilding the layer. */
  useEffect(() => {
    const L = leaflet.current;
    if (!ready || !L || !layer.current) return;

    layer.current.eachLayer((marker) => {
      const properties = propertiesOf(
        (marker as LeafletTypes.Layer & { feature?: { properties?: unknown } })
          .feature,
      );
      if (!properties || !(marker instanceof L.Marker)) return;

      const isSelected = properties.id === selectedId;
      const size = markerSize(isSelected);
      marker.setIcon(
        L.icon({
          iconUrl: markerPin(properties.color, properties.icon, isSelected),
          iconSize: [size.width, size.height],
          iconAnchor: [size.width / 2, size.height],
        }),
      );
    });
  }, [selectedId, ready]);

  /**
   * Shows only the chosen categories.
   *
   * An empty selection means everything, not nothing: a filter that hides the
   * whole map the moment you deselect the last chip is a trap.
   */
  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!ready || !L || !instance || !layer.current) return;

    layer.current.eachLayer((marker) => {
      const properties = propertiesOf(
        (marker as LeafletTypes.Layer & { feature?: { properties?: unknown } })
          .feature,
      );
      if (!properties) return;

      const visible =
        categoryIds.length === 0 || categoryIds.includes(properties.category);
      const element = (marker as LeafletTypes.Marker).getElement();
      if (element instanceof HTMLElement) {
        element.style.display = visible ? "" : "none";
      }
    });
  }, [categoryIds, ready]);

  /**
   * The province, as the MapLibre renderer draws it: the rest of the country
   * dimmed, the municipalities dashed inside a solid outline, and their names
   * until street level. Paths go in the overlay pane, beneath every marker.
   */
  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!ready || !L || !instance || !boundaries?.features.length) return;
    const group = L.layerGroup().addTo(instance);
    const line = { color: mapPalette.province, interactive: false };
    if (boundaries.outside) {
      L.geoJSON(boundaries.outside, {
        style: {
          ...line,
          weight: 2,
          opacity: 0.75,
          fillColor: mapPalette.outside,
          fillOpacity: 0.32,
        },
        interactive: false,
      }).addTo(group);
    }
    for (const feature of boundaries.features) {
      L.geoJSON(feature.geometry, {
        style: {
          ...line,
          weight: 1,
          opacity: 0.45,
          dashArray: "6 4",
          fill: false,
        },
        interactive: false,
      }).addTo(group);
      const at = feature.properties.label;
      if (at) {
        L.tooltip({
          permanent: true,
          direction: "center",
          className: "map-province-tooltip",
          interactive: false,
        })
          .setLatLng([at[1], at[0]])
          .setContent(feature.properties.name)
          .addTo(group);
      }
    }
    const fade = () => {
      instance
        .getContainer()
        .classList.toggle(
          "map-province-labels-hidden",
          instance.getZoom() >= 12,
        );
    };
    fade();
    instance.on("zoomend", fade);
    return () => {
      instance.off("zoomend", fade);
      group.remove();
    };
  }, [boundaries, ready]);

  /** The "you are here" dot, with its accuracy ring — see `locationFeatures`. */
  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!ready || !L || !instance || !myLocation) return;
    const at: LeafletTypes.LatLngTuple = [myLocation.lat, myLocation.lng];
    const group = L.layerGroup().addTo(instance);
    const color = mapPalette.location;
    if ((myLocation.accuracyMeters ?? 0) > MIN_ACCURACY_RING_M) {
      L.circle(at, {
        radius: myLocation.accuracyMeters,
        stroke: false,
        fillColor: color,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(group);
    }
    L.circleMarker(at, {
      radius: 15,
      stroke: false,
      fillColor: color,
      fillOpacity: 0.18,
      interactive: false,
    }).addTo(group);
    L.circleMarker(at, {
      radius: 7,
      color: "#ffffff",
      weight: 2.5,
      fillColor: color,
      fillOpacity: 1,
      interactive: false,
    }).addTo(group);
    return () => {
      group.remove();
    };
  }, [myLocation, ready]);

  // Zoom is drawn by `MapActions`, in one stack with "where am I", rather
  // than as this SDK's own widget — which looked like another product's
  // control beside ours. The renderer only lends it the verb.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance || !controllerRef) return;
    controllerRef.current = {
      zoomBy: (delta) => (delta > 0 ? instance.zoomIn() : instance.zoomOut()),
    };
    return () => {
      controllerRef.current = null;
    };
  }, [ready, controllerRef]);

  useEffect(() => {
    if (!flyTo || !ready) return;
    // `setView`, not `flyTo`: the zoom-out-and-back arc is disorienting on a
    // small screen and slower to read than a straight move. The offset is
    // subtracted in projected pixels at the destination zoom, so the point
    // lands at viewport centre plus offset — centre plus nothing without one.
    const instance = map.current;
    const L = leaflet.current;
    if (!instance || !L) return;
    const zoom = flyTo.zoom ?? 16;
    const target = flyTo.offset
      ? instance.unproject(
          instance
            .project([flyTo.lat, flyTo.lng], zoom)
            .subtract([flyTo.offset.x, flyTo.offset.y]),
          zoom,
        )
      : L.latLng(flyTo.lat, flyTo.lng);
    instance.setView(target, zoom, {
      animate: true,
    });
  }, [flyTo, ready]);

  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!ready || !L || !instance) return;
    const group = L.layerGroup().addTo(instance);
    for (const overlay of mapOverlays({
      communityFeatures,
      onSelectCommunity,
      trafficReports,
      onSelectTraffic,
      draftPath,
      hoverPath,
    })) {
      if (overlay.path && overlay.path.length > 1) {
        const path = overlay.path.map(
          ({ lat, lng }): LeafletTypes.LatLngTuple => [lat, lng],
        );
        L.polyline(path, {
          color: "#ffffff",
          weight: 9,
          interactive: false,
        }).addTo(group);
        L.polyline(path, { color: overlay.color, weight: 5 })
          .on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            if (!pickingLocation) overlay.select?.();
          })
          .addTo(group);
      }
      if (overlay.point && overlay.label) {
        const button = overlayChip(overlay);
        L.marker([overlay.point.lat, overlay.point.lng], {
          icon: L.divIcon({
            html: button,
            className: "map-overlay-icon",
            iconSize: [150, 40],
          }),
          title: overlay.label,
        })
          .on("click", (event) => {
            L.DomEvent.stopPropagation(event);
            if (!pickingLocation) overlay.select?.();
          })
          .addTo(group);
      }
    }
    return () => {
      group.remove();
    };
  }, [
    ready,
    communityFeatures,
    onSelectCommunity,
    trafficReports,
    onSelectTraffic,
    draftPath,
    hoverPath,
    pickingLocation,
  ]);

  useEffect(() => {
    const L = leaflet.current;
    const instance = map.current;
    if (!L || !instance || !searchMarker) return;

    const size = markerSize(true);
    const marker = L.marker([searchMarker.lat, searchMarker.lng], {
      icon: L.icon({
        iconUrl: markerPin("#2563eb", "map-pin", true),
        iconSize: [size.width, size.height],
        iconAnchor: [size.width / 2, size.height],
      }),
      interactive: false,
      title: searchMarker.label,
    }).addTo(instance);
    searchLayer.current = marker;

    return () => {
      marker.remove();
      if (searchLayer.current === marker) searchLayer.current = null;
    };
  }, [searchMarker]);

  useEffect(() => {
    const canvas = map.current?.getContainer();
    if (canvas) canvas.style.cursor = pickingLocation ? "grab" : "";
  }, [pickingLocation]);

  return (
    <>
      <div ref={container} className="isolate h-full w-full" />
      {failed && (
        <p
          role="status"
          className="absolute inset-x-4 bottom-24 z-30 rounded-lg bg-destructive/10 p-3 text-destructive text-sm"
        >
          {t("loadError")}
        </p>
      )}
    </>
  );
}
