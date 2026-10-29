import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/web/i18n";
import styles from "./public-page.module.css";

const t = getT("landing");
const PAGES = ["experience", "territory", "download"] as const;
type PublicPageName = (typeof PAGES)[number];

export function PublicPage({
  current,
  title,
  intro,
  children,
}: {
  current: PublicPageName;
  title: ReactNode;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <h1
            className={
              current === "download" ? undefined : styles.animatedTitle
            }
          >
            {title}
          </h1>
          <p className={styles.lead}>{intro}</p>
        </header>
        {children}
        <nav className={styles.continue} aria-label={t("pages.continue")}>
          <p className={styles.eyebrow}>{t("pages.continue")}</p>
          <div className={styles.continueLinks}>
            {PAGES.filter((page) => page !== current).map((page) => (
              <Link key={page} href={`/${page}`}>
                {t(`pages.${page}`)}
                <ArrowUpRight aria-hidden="true" size={19} />
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function PublicPageAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={styles.action}>
      {children}
      <ArrowUpRight aria-hidden="true" size={16} />
    </Link>
  );
}
