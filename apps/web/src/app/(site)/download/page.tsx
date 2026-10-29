import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { QrCode } from "@/components/landing/qr-code";
import { StoreButtons } from "@/components/landing/store-buttons";
import { PublicPage, PublicPageAction } from "@/components/site/public-page";
import styles from "@/components/site/public-page.module.css";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("pages.download"),
  description: t("pages.downloadDescription"),
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  const available = Boolean(site.iosUrl || site.androidUrl);

  return (
    <PublicPage
      current="download"
      eyebrow={t("pages.downloadEyebrow")}
      title={t("pages.downloadTitle")}
      intro={t("pages.downloadIntro")}
    >
      <section className={styles.panel} aria-labelledby="download-title">
        <div>
          <p className={styles.eyebrow}>{t("brand")}</p>
          <h2 id="download-title">{t("pages.downloadPanelTitle")}</h2>
          <p className={styles.body}>{t("pages.downloadPanelBody")}</p>
          <div className={styles.stores}>
            <StoreButtons
              iosUrl={site.iosUrl}
              androidUrl={site.androidUrl}
              labels={{
                ios: t("ios"),
                android: t("android"),
                iosSoon: t("iosSoon"),
                androidSoon: t("androidSoon"),
              }}
            />
          </div>
          <p className={styles.availability}>
            {available
              ? t("pages.downloadAvailable")
              : t("studio.availability")}
          </p>
        </div>
        <div className={styles.scan}>
          <div className={styles.qr}>
            <QrCode value={site.origin} label={t("scan")} />
          </div>
          <h3>{t("scan")}</h3>
          <p>{t("scanHint")}</p>
          <p>{t("pages.downloadQrBody")}</p>
        </div>
      </section>

      <section aria-labelledby="steps-title">
        <div className={styles.sectionHeading}>
          <h2 id="steps-title">{t("pages.downloadStepsTitle")}</h2>
        </div>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              01
            </span>
            <h3>{t("pages.downloadStepOneTitle")}</h3>
            <p>{t("pages.downloadStepOneBody")}</p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              02
            </span>
            <h3>{t("pages.downloadStepTwoTitle")}</h3>
            <p>{t("pages.downloadStepTwoBody")}</p>
            <Link href="/experience" className={styles.textLink}>
              {t("pages.experience")}
              <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </li>
          <li className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              03
            </span>
            <h3>{t("pages.downloadStepThreeTitle")}</h3>
            <p>{t("pages.downloadStepThreeBody")}</p>
            <div className="flex flex-wrap gap-x-4">
              <Link href="/privacy" className={styles.textLink}>
                {t("privacy")}
              </Link>
              <Link href="/terms" className={styles.textLink}>
                {t("terms")}
              </Link>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.help} aria-labelledby="help-title">
        <div>
          <h2 id="help-title">{t("pages.downloadHelpTitle")}</h2>
          <p>{t("pages.downloadHelpBody")}</p>
        </div>
        <PublicPageAction href="/support">{t("support")}</PublicPageAction>
      </section>
    </PublicPage>
  );
}
