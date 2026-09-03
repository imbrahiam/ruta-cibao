"use client";

import {
  addProtocol,
  type MapLayerMouseEvent,
  removeProtocol,
} from "maplibre-gl";
import { Protocol } from "pmtiles";
import { useCallback, useEffect, useMemo, useState } from "react";
import MapGL, {
  GeolocateControl,
  Layer,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import { publicEnv } from "@/lib/env.public";
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PLACES_SOURCE_ID,
  PLACES_TILE_URL,
  PROVINCE_BOUNDS,
  PROVINCE_CENTER,
} from "@/lib/map/config";
import { INTERACTIVE_LAYER_IDS, placesLayers } from "@/lib/map/layers";
import { buildMapStyle } from "@/lib/map/style";
import "maplibre-gl/dist/maplibre-gl.css";

/**
 * The map itself.
 *
 * Everything decided here — the style, the layers, the bounds — comes from
 * `@/lib/map`, which is plain data with no React in it. That is the seam a
 * React Native build would come in at: MapLibre Native reads the same style
 * JSON and the same tile URLs, and only this file would be replaced.
 */
function resolveBasemap() {
  if (publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL) {
    return {
      kind: "pmtiles",
      url: publicEnv.NEXT_PUBLIC_BASEMAP_PMTILES_URL,
    } as const;
  }
  if (publicEnv.NEXT_PUBLIC_MAPTILER_KEY) {
    return {
      kind: "maptiler",
      key: publicEnv.NEXT_PUBLIC_MAPTILER_KEY,
    } as const;
  }
  return { kind: "none" } as const;
}

export function CitizenMap({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (place: { id: string; slug: string } | null) => void;
}) {
  const [protocolReady, setProtocolReady] = useState(false);
  const basemap = useMemo(resolveBasemap, []);

  useEffect(() => {
    // A PMTiles archive is one file read by range request, which MapLibre only
    // understands once this protocol is registered. Registering it always would
    // be harmless, but doing it lazily keeps the library out of the bundle for
    // deployments that never use it.
    if (basemap.kind !== "pmtiles") {
      setProtocolReady(true);
      return;
    }

    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);
    setProtocolReady(true);

    return () => removeProtocol("pmtiles");
  }, [basemap.kind]);

  const style = useMemo(() => buildMapStyle(basemap), [basemap]);
  const layers = useMemo(() => placesLayers(selectedId), [selectedId]);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];

      // A tap on empty ground closes whatever was open, which is what people
      // expect from a map and saves them hunting for a close button.
      if (!feature) {
        onSelect(null);
        return;
      }

      const { id, slug } = feature.properties as { id?: string; slug?: string };
      onSelect(id && slug ? { id, slug } : null);
    },
    [onSelect],
  );

  if (!protocolReady) return null;

  return (
    <MapGL
      initialViewState={{ ...PROVINCE_CENTER, zoom: DEFAULT_ZOOM }}
      mapStyle={style}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      // This is a provincial platform. Letting someone pan to Santo Domingo and
      // find an empty map is worse than gently declining to go there.
      maxBounds={PROVINCE_BOUNDS}
      interactiveLayerIds={INTERACTIVE_LAYER_IDS}
      onClick={handleClick}
      cursor="default"
      attributionControl={{ compact: true }}
      style={{ position: "absolute", inset: 0 }}
      // The province is flat enough that tilting adds nothing and costs a
      // gesture people trigger by accident with two thumbs.
      pitchWithRotate={false}
      dragRotate={false}
      touchZoomRotate={{ around: "center" }}
    >
      <Source
        id={PLACES_SOURCE_ID}
        type="vector"
        tiles={[
          new URL(PLACES_TILE_URL, publicEnv.NEXT_PUBLIC_APP_URL).toString(),
        ]}
        minzoom={0}
        maxzoom={14}
      >
        {layers.map((layer) => (
          <Layer key={layer.id} {...layer} />
        ))}
      </Source>

      <NavigationControl position="bottom-right" showCompass={false} />
      <GeolocateControl
        position="bottom-right"
        trackUserLocation
        positionOptions={{ enableHighAccuracy: true }}
      />
    </MapGL>
  );
}
