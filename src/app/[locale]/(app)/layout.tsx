import type { ReactNode } from "react";
import { SiteFooter } from "@/components/shell/site-footer";
import { TabBar } from "@/components/shell/tab-bar";
import { TopNav } from "@/components/shell/top-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <TopNav />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <TabBar />
    </div>
  );
}
