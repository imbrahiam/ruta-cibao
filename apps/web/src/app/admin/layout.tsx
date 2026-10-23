import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminProviders } from "@/components/admin/providers";
import { AdminShell } from "@/components/admin/shell";
import { getT, pickMessages } from "@/lib/web/i18n";

const t = getT("admin");

export const metadata: Metadata = {
  title: t("title"),
  // The staff desk is never an entry point for search engines.
  robots: { index: false, follow: false },
};

/**
 * The staff area. Everything beneath is client-rendered behind the session
 * gate; the catalogue slice below is all the browser downloads of the text.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminProviders
      messages={pickMessages([
        "admin",
        "common",
        "reports",
        "time",
        "consultations",
      ])}
    >
      <Suspense>
        <AdminShell>{children}</AdminShell>
      </Suspense>
    </AdminProviders>
  );
}
