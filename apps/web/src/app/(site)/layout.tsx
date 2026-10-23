import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";

/** Chrome for the public pages: landing, legal text and shared links. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main id="contenido">{children}</main>
      <SiteFooter />
    </>
  );
}
