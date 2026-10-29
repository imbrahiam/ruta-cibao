import type { Viewport } from "next";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import styles from "@/components/site/site-shell.module.css";

export const viewport: Viewport = {
  themeColor: "#fafaf7",
  colorScheme: "light",
};

/** Chrome for the public pages: landing, legal text and shared links. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={styles.site}>
      <SiteHeader />
      <main id="contenido">{children}</main>
      <SiteFooter />
    </div>
  );
}
