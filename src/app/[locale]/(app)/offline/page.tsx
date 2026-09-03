import { CloudOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
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
export default async function OfflinePage() {
  const t = await getTranslations("offline");

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
