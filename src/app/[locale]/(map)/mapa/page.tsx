import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";
import { Spinner } from "@/components/ui/spinner";
import { mapPalette } from "@/lib/map/palette";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title") };
}

/**
 * What the screen shows before the map exists.
 *
 * The map's own ground colour and one line of text — not a grey rectangle
 * pretending to be a map. This is what the area genuinely looks like a moment
 * later, so nothing shifts when the real thing arrives.
 */
async function MapFallback() {
  const t = await getTranslations("map");

  return (
    <div
      className="flex size-full items-center justify-center"
      style={{ backgroundColor: mapPalette.land }}
      role="status"
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-muted-foreground text-sm">
        <Spinner className="size-4" />
        {t("loading")}
      </p>
    </div>
  );
}

export default function MapPage() {
  return (
    // Which place is open comes from the URL, and reading that is a runtime
    // access. Isolating it here is what lets the rest of the route prerender.
    <Suspense fallback={<MapFallback />}>
      <MapScreen />
    </Suspense>
  );
}
