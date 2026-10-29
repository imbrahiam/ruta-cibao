import {
  ArrowUpRight,
  FileText,
  MapPin,
  MessagesSquare,
  Route,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  AppScreenshot,
  hasScreenshot,
} from "@/components/landing/app-screenshot";
import {
  CommunityConcept,
  HeroConcept,
  LocalConcept,
  RoutesConcept,
} from "@/components/landing/concept-visual";
import { MunicipalityCards } from "@/components/landing/municipality-cards";
import { QrCode } from "@/components/landing/qr-code";
import { RotatingHeadline } from "@/components/landing/rotating-headline";
import { StoreButtons } from "@/components/landing/store-buttons";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";
import styles from "./page.module.css";

const t = getT("landing");

export const metadata: Metadata = {
  title: { absolute: `${t("brand")} · ${t("headline")}` },
  description: t("intro"),
  alternates: { canonical: "/" },
};

/** Only owner-provided app captures are eligible for the gallery. */
const SCREENS = [
  { file: "map", label: "mapScreen" },
  { file: "explore", label: "exploreScreen" },
  { file: "place", label: "placeScreen" },
  { file: "cases", label: "casesScreen" },
] as const;

const STORE_LABELS = {
  ios: t("ios"),
  android: t("android"),
  iosSoon: t("iosSoon"),
  androidSoon: t("androidSoon"),
};

export default function LandingPage() {
  const shown = SCREENS.filter((screen) => hasScreenshot(screen.file));
  const stores = Boolean(site.iosUrl || site.androidUrl);

  return (
    <div className={styles.landing}>
      <section
        className={`${styles.wrap} ${styles.hero}`}
        aria-labelledby="hero-title"
      >
        <p className={styles.heroNote}>
          <span aria-hidden="true" />
          {t("studio.forOurProvince")}
        </p>
        <RotatingHeadline
          prefix={t("studio.headlinePrefix")}
          phrases={[
            t("studio.headlineNear"),
            t("studio.headlineOurs"),
            t("studio.headlineHuman"),
          ]}
          lead={t("studio.headlineLead")}
          highlight={t("studio.headlineHighlight")}
        />
        <p className={styles.heroIntro}>{t("studio.intro")}</p>
        <div className={styles.heroActions}>
          <Link href="/download" className={styles.primaryAction}>
            {t("download")}
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
          <Link href="/experience" className={styles.secondaryAction}>
            {t("studio.explore")}
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <HeroConcept />
      </section>

      <section
        id="territory"
        aria-labelledby="territory-title"
        className={`${styles.wrap} ${styles.territory}`}
      >
        <h2 id="territory-title">{t("studio.territoryTitle")}</h2>
        <MunicipalityCards
          municipalities={[
            {
              name: t("sabaneta"),
              description: t("studio.territorySabaneta"),
            },
            {
              name: t("moncion"),
              description: t("studio.territoryMoncion"),
            },
            {
              name: t("almacigos"),
              description: t("studio.territoryAlmacigos"),
            },
          ]}
          conceptLabel={t("studio.territoryConcept")}
        />
        <Link href="/territory" className={styles.territoryAction}>
          {t("studio.territoryExplore")}
          <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </section>

      <section
        id="experience"
        aria-labelledby="experience-title"
        className={`${styles.wrap} ${styles.experience}`}
      >
        <div className={styles.sectionHeading}>
          <h2 id="experience-title" className={styles.sectionTitle}>
            {t("studio.experienceTitle")}
          </h2>
          <p className={styles.body}>{t("studio.experienceBody")}</p>
        </div>
        <div className={styles.discoveryGrid}>
          <article className={styles.discoveryCard}>
            <RoutesConcept />
            <div className={styles.cardCopy}>
              <span className={styles.categoryIcon}>
                <Route aria-hidden="true" size={20} strokeWidth={1.6} />
              </span>
              <h3>{t("studio.routesTitle")}</h3>
              <p>{t("studio.routesBody")}</p>
              <div className={styles.detailLine}>
                <TriangleAlert aria-hidden="true" size={15} />
                <span>{t("studio.trafficBody")}</span>
              </div>
            </div>
          </article>
          <article className={styles.discoveryCard}>
            <LocalConcept />
            <div className={styles.cardCopy}>
              <span className={styles.categoryIcon}>
                <Store aria-hidden="true" size={20} strokeWidth={1.6} />
              </span>
              <h3>{t("studio.localTitle")}</h3>
              <p>{t("studio.localBody")}</p>
              <div className={styles.detailLine}>
                <MapPin aria-hidden="true" size={15} />
                <span>{t("studio.mapBody")}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="community-title"
        className={`${styles.wrap} ${styles.community}`}
      >
        <div className={styles.sectionHeading}>
          <h2 id="community-title" className={styles.sectionTitle}>
            {t("studio.communityTitle")}
          </h2>
          <p className={styles.body}>{t("studio.communityBody")}</p>
        </div>
        <div className={styles.communityGrid}>
          <CommunityConcept />
          <div className={styles.communityDetails}>
            <article className={styles.communityFeature}>
              <span className={styles.communityIcon}>
                <MessagesSquare
                  aria-hidden="true"
                  size={22}
                  strokeWidth={1.5}
                />
              </span>
              <h3>{t("casesTitle")}</h3>
              <p>{t("casesBody")}</p>
            </article>
            <article className={styles.communityFeature}>
              <span className={styles.reportIcon}>
                <FileText aria-hidden="true" size={22} strokeWidth={1.5} />
              </span>
              <h3>{t("reportsTitle")}</h3>
              <p>{t("reportsBody")}</p>
            </article>
          </div>
        </div>
        <div className={styles.municipal}>
          <div>
            <h3>{t("studio.municipalTitle")}</h3>
            <p>{t("studio.municipalBody")}</p>
          </div>
          <Link href="/admin" className={styles.secondaryAction}>
            {t("staff")}
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>
      </section>

      {shown.length > 0 ? (
        <section
          aria-labelledby="screens-title"
          className={`${styles.wrap} ${styles.screens}`}
        >
          <div className={styles.sectionHeading}>
            <h2 id="screens-title" className={styles.sectionTitle}>
              {t("screenshots")}
            </h2>
            <p className={styles.body}>{t("studio.realScreens")}</p>
          </div>
          <div className={styles.screenGallery}>
            {shown.map((screen) => (
              <AppScreenshot
                key={screen.file}
                name={screen.file}
                screen={t(screen.label)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section
        id="download"
        aria-labelledby="download-title"
        className={`${styles.wrap} ${styles.download}`}
      >
        <div className={styles.downloadPanel}>
          <div className={styles.downloadContent}>
            <p className={styles.downloadNote}>
              <MapPin aria-hidden="true" size={15} />
              {t("brand")}
            </p>
            <h2 id="download-title" className={styles.sectionTitle}>
              {t("studio.downloadTitle")}
            </h2>
            <p className={styles.body}>{t("studio.downloadBody")}</p>
            <div className={styles.storeActions}>
              <StoreButtons
                iosUrl={site.iosUrl}
                androidUrl={site.androidUrl}
                labels={STORE_LABELS}
              />
            </div>
            {!stores ? (
              <p className={styles.availability}>{t("studio.availability")}</p>
            ) : null}
          </div>
          <div className={styles.scanCard}>
            <div className={styles.qrFrame}>
              <QrCode value={site.origin} label={t("scan")} />
            </div>
            <p>{t("scan")}</p>
            <span>{t("scanHint")}</span>
          </div>
        </div>
        <p className={styles.closingNote}>{t("province")}</p>
      </section>
    </div>
  );
}
