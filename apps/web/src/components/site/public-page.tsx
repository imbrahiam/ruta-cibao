import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/web/i18n";
import styles from "./public-page.module.css";

const t = getT("landing");
const PAGES = ["experience", "territory", "download"] as const;
type PublicPageName = (typeof PAGES)[number];

export function PublicPage({
  current,
  eyebrow,
  title,
  intro,
  children,
}: {
  current: PublicPageName;
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.pageNav}>
          <Link href="/" className={styles.back}>
            <ArrowLeft aria-hidden="true" size={15} />
            {t("back")}
          </Link>
          <nav aria-label={t("pages.navLabel")}>
            <ul className={styles.tabs}>
              {PAGES.map((page) => (
                <li key={page}>
                  <Link
                    href={`/${page}`}
                    aria-current={current === page ? "page" : undefined}
                  >
                    {t(`pages.${page}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
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
