"use client";

import { STREET_SELECTION } from "@/lib/map/traffic-colors";
import { GoogleMarker } from "./google-marker";
import { GooglePolyline } from "./google-polyline";

type LatLng = { lng: number; lat: number };

/**
 * The stretch of road being chosen for a traffic report.
 *
 * One dark line with a white halo, a white cap at each end, and — when the
 * street was tapped rather than aimed at — a dot where the tap landed on it.
 * The caps are the point: the extent buttons move them, so a person can see
 * the difference between 150 m and 500 m on the map instead of reading it.
 *
 * The caps sit in an overlay pane above the line and below the pins, and take
 * no pointer events, so tapping through them still reaches the map.
 */
function Cap({ ring = false }: { ring?: boolean }) {
  return (
    <span
      aria-hidden
      className="block rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
      style={{
        width: ring ? 16 : 12,
        height: ring ? 16 : 12,
        backgroundColor: ring ? STREET_SELECTION.stroke : STREET_SELECTION.cap,
        border: `3px solid ${ring ? STREET_SELECTION.cap : STREET_SELECTION.stroke}`,
      }}
    />
  );
}

export function StreetSelection({
  mapId,
  path,
  anchor,
}: {
  mapId: string;
  path: LatLng[];
  anchor?: LatLng | null;
}) {
  const start = path[0];
  const end = path[path.length - 1];
  if (!start || !end || path.length < 2) return null;

  return (
    <>
      <GooglePolyline
        mapId={mapId}
        path={path}
        color={STREET_SELECTION.stroke}
        weight={8}
        zIndex={20}
      />
      <GoogleMarker mapId={mapId} position={start} anchor="center" zIndex={21}>
        <Cap />
      </GoogleMarker>
      <GoogleMarker mapId={mapId} position={end} anchor="center" zIndex={21}>
        <Cap />
      </GoogleMarker>
      {anchor && (
        <GoogleMarker
          mapId={mapId}
          position={anchor}
          anchor="center"
          zIndex={22}
        >
          <Cap ring />
        </GoogleMarker>
      )}
    </>
  );
}
