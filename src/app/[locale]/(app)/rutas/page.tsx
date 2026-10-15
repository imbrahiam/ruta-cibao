import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { RouteDirectory } from "@/components/routes/route-directory";
export async function generateMetadata() {
  const t = await getTranslations("navigation");
  return { title: t("routes") };
}

export default function Page() {
  return (
    <Suspense>
      <RouteDirectory />
    </Suspense>
  );
}
