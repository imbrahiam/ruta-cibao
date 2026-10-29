import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getT } from "@/lib/web/i18n";
import styles from "./site-shell.module.css";

/** Public navigation stays in document flow, including on narrow screens. */
export function SiteHeader() {
  const t = getT("landing");

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" aria-label={t("brand")}>
          <Logo label={t("brand")} />
        </Link>
        <nav aria-label={t("navLabel")} className={styles.nav}>
          <Link href="/download" className={styles.downloadLink}>
            {t("download")}
          </Link>
          <Link href="/admin" className={styles.navLink}>
            {t("staff")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
