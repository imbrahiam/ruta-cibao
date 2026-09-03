import { CloudOff } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * What the service worker shows when a page cannot be reached.
 *
 * Fully static, so it is available precisely when nothing else is.
 */
export default async function OfflinePage({
  params,
}: PageProps<"/[locale]/offline">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "offline" });

  return (
    <Empty className="py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CloudOff />
        </EmptyMedia>
        <EmptyTitle>{t("pageTitle")}</EmptyTitle>
        <EmptyDescription>{t("pageBody")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
