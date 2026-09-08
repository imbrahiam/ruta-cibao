"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function OfflineRecovery() {
  const t = useTranslations("offline");
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button className="h-11" onClick={() => window.location.reload()}>
        {t("reload")}
      </Button>
      <Button
        variant="outline"
        className="h-11"
        nativeButton={false}
        render={<Link href="/mapa" />}
      >
        {t("openMap")}
      </Button>
    </div>
  );
}
