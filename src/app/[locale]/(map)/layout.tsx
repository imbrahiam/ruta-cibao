import { MapRail } from "@/components/map/map-rail";
import { SiteNav } from "@/components/shell/site-nav";

/**
 * Full-bleed shell for the map.
 *
 * No header. A map wants every pixel of height it has, and a band across the
 * top takes it from the one thing the page exists to show — so the navigation
 * moved into a rail down the side, where the cost is width the map has more of
 * to spare.
 *
 * `h-dvh` rather than `h-screen`: on a phone the address bar collapses as you
 * scroll, and `100vh` would leave a strip hidden underneath it.
 */
export default function MapLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="flex h-dvh w-full overflow-hidden pb-(--mobile-nav-height) md:pb-0">
      <MapRail />
      <main id="contenido" className="relative min-w-0 flex-1">
        {children}
      </main>
      <SiteNav mobile />
    </div>
  );
}
