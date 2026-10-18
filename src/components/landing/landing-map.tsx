"use client";

import { useTranslations } from "next-intl";
import { MapCanvas } from "@/components/map/map-core";
import { PlaceMarkers } from "@/components/map/place-markers";
import { ProvinceLayers } from "@/components/map/province-layers";
import { useRouter } from "@/i18n/navigation";
import { PROVINCE_BOUNDS } from "@/lib/map/config";

const NONE = new Set<string>();

/**
 * The hero is the product itself: the province on the real map, with the
 * real places on it. It does not pan or zoom (the page scrolls, the map
 * should not steal that), but a pin still opens its place.
 */
export function LandingMap() {
  const t = useTranslations("landing");
  const router = useRouter();
  return (
    <MapCanvas
      label={t("mapLabel")}
      bounds={PROVINCE_BOUNDS}
      padding={{ top: 28, bottom: 28, left: 28, right: 28 }}
      interactive={false}
      className="absolute inset-0"
    >
      <ProvinceLayers />
      <PlaceMarkers
        categories={NONE}
        selectedSlug={null}
        selectedFallback={null}
        onSelect={(place) => router.push(`/mapa?lugar=${place.slug}`)}
      />
    </MapCanvas>
  );
}
