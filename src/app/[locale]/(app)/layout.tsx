import type { ReactNode } from "react";
import { OfflineNotice } from "@/components/pwa/offline-notice";
import { SiteFooter } from "@/components/shell/site-footer";
import { TabBar } from "@/components/shell/tab-bar";
import { TopNav } from "@/components/shell/top-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <TopNav />
      <OfflineNotice className="sticky top-[84px] z-30 -mb-10 px-4" />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <TabBar />
    </div>
  );
}
