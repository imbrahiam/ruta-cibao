import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { FeatureRows } from "@/components/landing/feature-rows";
import { Hero } from "@/components/landing/hero";
import {
  NumbersSkeleton,
  NumbersStrip,
} from "@/components/landing/numbers-strip";
import { PlacesRow, PlacesSkeleton } from "@/components/landing/places-row";
import { RoadNotice } from "@/components/landing/road-notice";
import { Territory, TerritorySkeleton } from "@/components/landing/territory";

/**
 * The public front door, in the order of docs/DESIGN-LANGUAGE.md: what is
 * closed today, a question with a search, the province in numbers, the
 * territory, the six jobs, places to visit.
 *
 * Everything that reads the database streams into its own boundary, so the
 * hero and the feature rows are in the static shell and paint first; each
 * fallback is the same height as what replaces it.
 */
export async function generateMetadata() {
  const t = await getTranslations("app");
  // The home page names what this is, not just whose it is.
  return { title: { absolute: `${t("name")} · ${t("tagline")}` } };
}

export default function Landing() {
  return (
    <>
      <Suspense fallback={null}>
        <RoadNotice />
      </Suspense>
      <Hero />
      <Suspense fallback={<NumbersSkeleton />}>
        <NumbersStrip />
      </Suspense>
      <Suspense fallback={<TerritorySkeleton />}>
        <Territory />
      </Suspense>
      <FeatureRows />
      <Suspense fallback={<PlacesSkeleton />}>
        <PlacesRow />
      </Suspense>
    </>
  );
}
