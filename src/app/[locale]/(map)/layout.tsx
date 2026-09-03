import { AppHeader } from "@/components/shell/app-header";

/**
 * Full-bleed shell for the map.
 *
 * The map takes the whole viewport and the header floats over it, because a map
 * boxed inside a content column is a picture of a map. `h-dvh` rather than
 * `h-screen`: on a phone the address bar collapses as you scroll, and
 * `100vh` would leave a strip of the page hidden underneath it.
 */
export default function MapLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-30">
        <AppHeader />
      </div>
      <main id="contenido" className="absolute inset-0">
        {children}
      </main>
    </div>
  );
}
