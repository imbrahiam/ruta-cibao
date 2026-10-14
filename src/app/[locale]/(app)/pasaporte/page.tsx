import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PassportScreen } from "@/components/passport/passport-screen";

export async function generateMetadata() {
  const t = await getTranslations("passport");
  return { title: t("title") };
}

export default function PassportPage() {
  return (
    <Suspense>
      <PassportScreen />
    </Suspense>
  );
}
