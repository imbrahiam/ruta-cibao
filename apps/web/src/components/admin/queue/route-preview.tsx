"use client";

import { useFormatter, useTranslations } from "use-intl";

type Point = { lng: number; lat: number };

const SIZE = 240;
const PADDING = 14;

/**
 * Fits a traced path into a box, keeping its proportions.
 *
 * Longitude degrees shrink with latitude, so x is scaled by cos(latitude) or
 * a route would look wider than it is. Plain equirectangular maths is exact
 * enough at the scale of one route.
 */
function fit(path: readonly Point[]) {
  const lngs = path.map((point) => point.lng);
  const lats = path.map((point) => point.lat);
  const minLng = Math.min(...lngs);
  const maxLat = Math.max(...lats);
  const midLat = (maxLat + Math.min(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const width = Math.max((Math.max(...lngs) - minLng) * k, 1e-6);
  const height = Math.max(maxLat - Math.min(...lats), 1e-6);
  const scale = (SIZE - 2 * PADDING) / Math.max(width, height);

  return {
    width: width * scale + 2 * PADDING,
    height: height * scale + 2 * PADDING,
    points: path.map(
      (point) =>
        [
          PADDING + (point.lng - minLng) * k * scale,
          PADDING + (maxLat - point.lat) * scale,
        ] as const,
    ),
  };
}

/**
 * The traced route as a line, without a map: enough for a reviewer to see
 * whether it is a plausible trail and not a scribble. The text alternative
 * carries the number of points and the distance, and the legend says which
 * end is which by shape as well as by label.
 */
export function RoutePreview({
  path,
  distanceMeters,
}: {
  path: readonly Point[];
  distanceMeters: number;
}) {
  const t = useTranslations("admin.queue");
  const format = useFormatter();
  if (path.length < 2) return null;

  const { width, height, points } = fit(path);
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return null;

  const alt = t("pathAlt", {
    points: path.length,
    distance: format.number(distanceMeters / 1000, "distance"),
  });

  return (
    <figure className="flex flex-col gap-2">
      <svg
        role="img"
        aria-label={alt}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-xs rounded-card bg-paper-2"
      >
        <polyline
          points={points
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join(" ")}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={first[0]} cy={first[1]} r={5.5} fill="var(--accent)" />
        <circle
          cx={last[0]}
          cy={last[1]}
          r={5.5}
          fill="var(--card)"
          stroke="var(--accent)"
          strokeWidth={3}
        />
      </svg>
      <figcaption aria-hidden className="t-small flex gap-4 text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-accent" />
          {t("pathStart")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-accent bg-card" />
          {t("pathEnd")}
        </span>
      </figcaption>
    </figure>
  );
}
