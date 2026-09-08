import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PlaceDirectory } from "@/components/discover/place-directory";

export async function generateMetadata() {
  const t = await getTranslations("discover");
  return { title: t("title") };
}

export default function ExplorePage() {
  return (
    <Suspense>
      <PlaceDirectory />
    </Suspense>
  );
}
