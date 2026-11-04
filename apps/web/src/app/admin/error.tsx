"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { AdminEmpty } from "@/components/admin/page-frame";
import { Button } from "@/components/ui/button";

/** A screen that crashed: the shell and sidebar stay, only the page is replaced. */
export default function AdminError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useTranslations("admin.boundary");
  const common = useTranslations("common");
  return (
    <AdminEmpty
      icon={TriangleAlert}
      title={t("errorTitle")}
      description={t("errorBody")}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>{common("retry")}</Button>
          <Button variant="outline" asChild>
            <Link href="/admin">{t("backToDesk")}</Link>
          </Button>
        </div>
      }
    />
  );
}
