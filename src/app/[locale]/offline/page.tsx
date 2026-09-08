import { CloudOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { OfflineRecovery } from "@/components/offline/offline-recovery";
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
    <main
      id="contenido"
      className="flex min-h-dvh items-center justify-center px-5"
    >
      {/* No card here either: like every route-level state, the content is
          the page, centred on the background. */}
      <Empty className="max-w-lg py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CloudOff />
          </EmptyMedia>
          <EmptyTitle>
            <h1>{t("pageTitle")}</h1>
          </EmptyTitle>
          <EmptyDescription>{t("pageBody")}</EmptyDescription>
        </EmptyHeader>
        <OfflineRecovery />
      </Empty>
    </main>
  );
}
