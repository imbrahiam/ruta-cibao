import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { MapScreen } from "@/components/map/map-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title") };
}

/**
 * The map reads its state from the URL, which only exists at request time, so
 * the static shell is the ground colour and the search pill's outline: the
 * same frame the map then fills, with nothing to jump.
 */
export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-paper-2">
          <div className="glass mx-3 mt-[max(10px,env(safe-area-inset-top))] h-12 rounded-full md:mt-4 md:ml-[76px] md:w-[344px]" />
        </div>
      }
    >
      <MapScreen />
    </Suspense>
  );
}
