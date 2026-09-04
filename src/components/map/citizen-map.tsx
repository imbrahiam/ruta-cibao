"use client";

import dynamic from "next/dynamic";
import { publicEnv } from "@/lib/env.public";
import { CitizenMapGoogle } from "./citizen-map-google";
import type { CitizenMapProps } from "./types";

/**
 * Picks the map renderer.
 *
 * Three exist because the choice is genuinely open, and each answers a
 * different question:
 *
 *   `google`    familiar and reliable. Billed per map load — a recurring cost
 *               the municipality inherits — and no offline map, since its terms
 *               forbid caching tiles.
 *   `leaflet`   raster tiles from CARTO. No key, no bill, renders anywhere.
 *   `maplibre`  vector tiles from Postgres over a self-hosted PMTiles basemap.
 *               No bill and works offline; the sustainability argument, and the
 *               one that takes the most care to get right.
 *
 * None is deleted while this is undecided. They share one props type and one
 * GeoJSON endpoint, so switching changes what draws the points and nothing
 * about where they come from.
 *
 * The two that are not selected are imported lazily, so an unused renderer
 * costs nothing in the bundle.
 */
const CitizenMapLeaflet = dynamic(
  () => import("./citizen-map-leaflet").then((module) => module.CitizenMap),
  { ssr: false },
);

const CitizenMapLibre = dynamic(
  () => import("./citizen-map-maplibre").then((module) => module.CitizenMap),
  { ssr: false },
);

export function CitizenMap(props: CitizenMapProps) {
  switch (publicEnv.NEXT_PUBLIC_MAP_RENDERER) {
    case "leaflet":
      return <CitizenMapLeaflet {...props} />;
    case "maplibre":
      return <CitizenMapLibre {...props} />;
    default:
      return <CitizenMapGoogle {...props} />;
  }
}
