import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";
import styles from "./site-shell.module.css";

export function SiteFooter() {
  const t = getT("landing");

  return (
    <footer id="site-footer" className={styles.footer}>
      <div className={styles.footerMain}>
        <div className={styles.footerIdentity}>
          <Link href="/" className={styles.footerBrand} aria-label={t("back")}>
            <Logo label={t("brand")} />
          </Link>
          <p className={styles.footerOrigin}>
            <span className={styles.flag} aria-hidden="true">
              🇩🇴
            </span>
            <span>{t("province")}</span>
          </p>
        </div>
        <nav className={styles.footerGroup} aria-label={t("pages.navLabel")}>
          <h2>{t("footerExplore")}</h2>
          <ul>
            <li>
              <Link href="/experience" className={styles.footerLink}>
                {t("pages.experience")}
              </Link>
            </li>
            <li>
              <Link href="/territory" className={styles.footerLink}>
                {t("pages.territory")}
              </Link>
            </li>
            <li>
              <Link href="/download" className={styles.footerLink}>
                {t("pages.download")}
              </Link>
            </li>
          </ul>
        </nav>
        <nav className={styles.footerGroup} aria-label={t("footerLabel")}>
          <h2>{t("footerHelp")}</h2>
          <ul>
            <li>
              <Link href="/support" className={styles.footerLink}>
                {t("support")}
              </Link>
            </li>
            <li>
              <Link href="/account/delete" className={styles.footerLink}>
                {t("deletion")}
              </Link>
            </li>
            <li>
              <Link href="/admin" className={styles.footerLink}>
                {t("staff")}
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <p className={styles.footerNotice}>{t("notice")}</p>
        <ul className={styles.footerLegal}>
          <li>
            <Link href="/privacy" className={styles.footerLink}>
              {t("privacy")}
            </Link>
          </li>
          <li>
            <Link href="/terms" className={styles.footerLink}>
              {t("terms")}
            </Link>
          </li>
          {site.sourceUrl ? (
            <li>
              <a
                href={site.sourceUrl}
                rel="noopener"
                className={styles.footerLink}
              >
                {t("source")}
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </footer>
  );
}
