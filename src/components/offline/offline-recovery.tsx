"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function OfflineRecovery() {
  const t = useTranslations("offline");
  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Button onClick={() => window.location.reload()}>{t("reload")}</Button>
      <Button
        variant="outline"
        nativeButton={false}
        render={<Link href="/mapa" />}
      >
        {t("openMap")}
      </Button>
    </div>
  );
}
