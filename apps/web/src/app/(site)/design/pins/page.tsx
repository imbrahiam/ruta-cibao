import type { Metadata } from "next";
import Link from "next/link";
import { LocationPin } from "@/components/landing/location-pin";
import headlineStyles from "@/components/landing/rotating-headline.module.css";
import { getT } from "@/lib/web/i18n";
import styles from "./page.module.css";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("pinComparison.title"),
  robots: { index: false, follow: false },
  alternates: { canonical: "/design/pins" },
};

export default function PinComparisonPage() {
  return (
    <div className={styles.page}>
      <h1>{t("pinComparison.title")}</h1>
      <p className={styles.intro}>{t("pinComparison.intro")}</p>
      <div className={styles.variants}>
        {(["classic", "lollipop"] as const).map((variant) => (
          <section key={variant} className={styles.variant}>
            <h2>{t(`pinComparison.${variant}`)}</h2>
            <div className={styles.sample}>
              {t("studio.headlineLead")}{" "}
              <span className={headlineStyles.locationAccent}>
                <span className={headlineStyles.highlight}>
                  {t("studio.headlineHighlight")}
                </span>
                <span className={headlineStyles.locationBadge}>
                  <LocationPin variant={variant} />
                </span>
              </span>
            </div>
            <p>{t(`pinComparison.${variant}Note`)}</p>
          </section>
        ))}
      </div>
      <Link href="/" className={styles.back}>
        {t("pinComparison.back")}
      </Link>
    </div>
  );
}
