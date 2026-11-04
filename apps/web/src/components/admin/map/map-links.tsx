"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { CopyButton } from "../contact/copy-button";
import type { LatLng } from "./map-types";

/** `19.47772, -71.33688`: the form that pastes into any map search box. */
export function formatCoordinates({ lat, lng }: LatLng): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const googleMapsUrl = ({ lat, lng }: LatLng) =>
  `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

const openStreetMapUrl = ({ lat, lng }: LatLng) =>
  `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

const LINK =
  "inline-flex items-center gap-1.5 rounded-sm text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11";

function External({ href, children }: { href: string; children: string }) {
  const t = useTranslations("admin.queue");
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
      <ExternalLink aria-hidden className="size-3.5" />
      <span className="sr-only">{t("newTab")}</span>
    </a>
  );
}

/** Where a coordinate is, in other maps, for when the desk's own will not do. */
export function MapLinks({
  point,
  className,
  only,
}: {
  point: LatLng;
  className?: string;
  /** Just one of the two, where room is tight. */
  only?: "google" | "osm";
}) {
  const t = useTranslations("admin.queue");
  return (
    <span className={cn("inline-flex flex-wrap gap-x-4", className)}>
      {only !== "osm" ? (
        <External href={googleMapsUrl(point)}>{t("map.openGoogle")}</External>
      ) : null}
      {only !== "google" ? (
        <External href={openStreetMapUrl(point)}>{t("openInMaps")}</External>
      ) : null}
    </span>
  );
}

/** The coordinate as text, with a button that copies it. */
export function CoordinateLine({
  point,
  className,
}: {
  point: LatLng;
  className?: string;
}) {
  const t = useTranslations("admin.queue.map");
  const text = formatCoordinates(point);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span className="tabular-nums">{text}</span>
      <CopyButton value={text} what={t("theCoordinates")} />
    </span>
  );
}
