import { AppHeader } from "@/components/shell/app-header";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteNav } from "@/components/shell/site-nav";
import "./landing.css";

export default function LandingLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-(--mobile-nav-height) md:pb-0">
      <AppHeader />
      <main id="contenido">{children}</main>
      <SiteFooter />
      <SiteNav mobile />
    </div>
  );
}
