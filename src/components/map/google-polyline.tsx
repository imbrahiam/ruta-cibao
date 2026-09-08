"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

/**
 * A line on the map.
 *
 * `google.maps.Polyline` is imperative and has no component in the library, so
 * this wraps one: created once, its path and colours updated in place, removed
 * on unmount. Updating rather than recreating matters more here than it looks —
 * the stretch preview changes on every idle while somebody is choosing, and a
 * new Polyline per change flickers and leaks listeners.
 *
 * Two strokes rather than one: a wide, soft halo under a solid core. A single
 * coloured line disappears over a road of a similar colour, and over satellite
 * imagery it disappears over everything. The halo is what makes the same line
 * legible on all three basemaps without giving it a hard outline that would
 * read as a border.
 *
 * It is also what makes a shaded street read as *shading* rather than as
 * another road drawn on top of the map.
 */
type LatLng = { lng: number; lat: number };

export function GooglePolyline({
  mapId,
  path,
  color,
  /** Heavier for the road being chosen than for the ones already reported. */
  weight = 6,
  /** Below 1 for a road merely being offered, rather than one chosen. */
  opacity = 1,
  zIndex = 1,
  onClick,
}: {
  mapId: string;
  path: LatLng[];
  color: string;
  weight?: number;
  opacity?: number;
  zIndex?: number;
  onClick?: () => void;
}) {
  const map = useMap(mapId);
  const haloRef = useRef<google.maps.Polyline | null>(null);
  const coreRef = useRef<google.maps.Polyline | null>(null);
  const clickRef = useRef(onClick);
  clickRef.current = onClick;
  const clickable = onClick !== undefined;

  useEffect(() => {
    if (!map) return;

    const halo = new google.maps.Polyline({
      map,
      clickable: false,
    });

    const core = new google.maps.Polyline({
      map,
      clickable: false,
    });

    const listener = core.addListener("click", () => clickRef.current?.());

    haloRef.current = halo;
    coreRef.current = core;

    return () => {
      listener.remove();
      halo.setMap(null);
      core.setMap(null);
      haloRef.current = null;
      coreRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const coordinates = path.map(({ lat, lng }) => ({ lat, lng }));
    if (!map) return;
    // Selection changes styling, not the identity of the road. Recreating the
    // objects on a weight change left them empty when `path` was unchanged.
    haloRef.current?.setOptions({
      path: coordinates,
      strokeColor: "#ffffff",
      strokeOpacity: 0.9 * opacity,
      strokeWeight: weight + 5,
      zIndex,
    });
    coreRef.current?.setOptions({
      path: coordinates,
      strokeColor: color,
      strokeOpacity: opacity,
      strokeWeight: weight,
      zIndex: zIndex + 1,
      clickable,
    });
  }, [map, path, color, weight, opacity, zIndex, clickable]);

  return null;
}
