"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { publicEnv } from "@/lib/env.public";
import { mapPalette } from "@/lib/map/palette";
import { supportsVectorMap } from "@/lib/map/render-support";
import type { CitizenMapProps } from "./types";

/**
 * Picks the map renderer.
 *
 * MapLibre is the default; two optional renderers cover other deployments:
 *
 *   `google`    familiar and reliable. Billed per map load — a recurring cost
 *               the municipality inherits — and no offline map, since its terms
 *               forbid caching tiles.
 *   `leaflet`   online raster tiles; automatic fallback without hardware WebGL.
 *   `maplibre`  vector tiles from Postgres over a self-hosted PMTiles basemap.
 *               No bill and works offline; the sustainability argument, and the
 *               one that takes the most care to get right.
 *
 * They share one props type and one
 * GeoJSON endpoint, so switching changes what draws the points and nothing
 * about where they come from.
 *
 * The two that are not selected are imported lazily, so an unused renderer
 * costs nothing in the bundle.
 */
const CitizenMapGoogle = dynamic(
  () =>
    import("./citizen-map-google").then((module) => module.CitizenMapGoogle),
  { ssr: false },
);

const CitizenMapLeaflet = dynamic(
  () => import("./citizen-map-leaflet").then((module) => module.CitizenMap),
  { ssr: false },
);

const CitizenMapLibre = dynamic(
  () => import("./citizen-map-maplibre").then((module) => module.CitizenMap),
  { ssr: false },
);

export function CitizenMap(props: CitizenMapProps) {
  const t = useTranslations("map.place");
  const [vectorSupported, setVectorSupported] = useState<boolean | null>(null);
  useEffect(() => {
    if (publicEnv.NEXT_PUBLIC_MAP_RENDERER === "maplibre")
      setVectorSupported(supportsVectorMap());
  }, []);
  switch (publicEnv.NEXT_PUBLIC_MAP_RENDERER) {
    case "leaflet":
      return <CitizenMapLeaflet {...props} />;
    case "maplibre":
      if (vectorSupported === null)
        return (
          <div
            role="status"
            className="h-full w-full"
            style={{ backgroundColor: mapPalette.land }}
          >
            {/* The ground colour says "map" sooner than a word does, and a
                word flashing for a frame before the map reads as a glitch. */}
            <span className="sr-only">{t("loading")}</span>
          </div>
        );
      return vectorSupported ? (
        <CitizenMapLibre {...props} />
      ) : (
        <CitizenMapLeaflet {...props} />
      );
    default:
      return <CitizenMapGoogle {...props} />;
  }
}
