import { AppHeader } from "@/components/shell/app-header";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteNav } from "@/components/shell/site-nav";

export default function LandingLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="min-h-dvh pb-(--mobile-nav-height) md:pb-0">
      <AppHeader />
      <main id="contenido">{children}</main>
      <SiteFooter />
      <SiteNav mobile />
    </div>
  );
}
