import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PlaceDirectory } from "@/components/discover/place-directory";

export async function generateMetadata() {
  // The section's name, as the tab bar says it, not the page's slogan.
  const t = await getTranslations("navigation");
  return { title: t("explore") };
}

export default function ExplorePage() {
  return (
    <Suspense>
      <PlaceDirectory />
    </Suspense>
  );
}
