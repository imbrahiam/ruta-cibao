"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { AdminEmpty } from "@/components/admin/page-frame";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  const t = useTranslations("admin.boundary");
  return (
    <AdminEmpty
      icon={SearchX}
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
      action={
        <Button asChild>
          <Link href="/admin">{t("backToDesk")}</Link>
        </Button>
      }
    />
  );
}
