import {
  ArrowDown,
  ArrowDownRight,
  ArrowUpRight,
  Asterisk,
  FileText,
  Map as MapIcon,
  MapPin,
  MessagesSquare,
  Route,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  AppScreenshot,
  hasScreenshot,
} from "@/components/landing/app-screenshot";
import { QrCode } from "@/components/landing/qr-code";
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

const DISCOVERY_FEATURES = [
  { icon: Store, title: "businessTitle", body: "businessBody" },
  { icon: Route, title: "routesTitle", body: "routesBody" },
  { icon: TriangleAlert, title: "trafficTitle", body: "trafficBody" },
] as const;

const COMMUNITY_FEATURES = [
  { icon: MessagesSquare, title: "casesTitle", body: "casesBody" },
  { icon: FileText, title: "reportsTitle", body: "reportsBody" },
] as const;

const STORE_LABELS = {
  ios: t("ios"),
  android: t("android"),
  iosSoon: t("iosSoon"),
  androidSoon: t("androidSoon"),
};

const MUNICIPALITIES = ["sabaneta", "moncion", "almacigos"] as const;

export default function LandingPage() {
  const shown = SCREENS.filter((screen) => hasScreenshot(screen.file));
  const stores = Boolean(site.iosUrl || site.androidUrl);

  return (
    <div className={styles.landing}>
      <section
        className={`${styles.wrap} ${styles.hero}`}
        aria-labelledby="hero-title"
      >
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowDot} aria-hidden />
          {t("designEyebrow")}
        </p>
        <h1 id="hero-title" className={styles.heroTitle}>
          {t("designHeadline")}
          <span>{t("designAccent")}</span>
        </h1>
        <div className={styles.heroBottom}>
          <p className={styles.heroIntro}>{t("designIntro")}</p>
          <a href="#experience" className={styles.primaryAction}>
            {t("designExplore")}
            <ArrowUpRight aria-hidden size={20} />
          </a>
        </div>
      </section>

      <div className={`${styles.wrap} ${styles.landscapeWrap}`}>
        <figure className={styles.landscape}>
          <Image
            src="/places/presa-moncion.webp"
            alt={t("designPhotoAlt")}
            width={960}
            height={640}
            sizes="(max-width: 640px) calc(100vw - 32px), (max-width: 1440px) calc(100vw - 80px), 1280px"
            preload
            className={styles.landscapeImage}
          />
          <div className={styles.locationBadge}>
            <MapPin aria-hidden size={15} />
            {t("designPhoto")}
          </div>
          <figcaption className={styles.landscapeCaption}>
            <span>{t("designEdition")}</span>
            <a
              href="#territory"
              className={styles.photoAction}
              aria-label={t("designScroll")}
            >
              <ArrowDown aria-hidden size={25} />
            </a>
          </figcaption>
        </figure>
        <div className={styles.photoFootnote}>
          <p>{t("province")}</p>
          <a href="#territory">
            {t("designScroll")}
            <ArrowDownRight aria-hidden size={15} />
          </a>
        </div>
      </div>

      <section
        id="territory"
        aria-labelledby="territory-title"
        className={`${styles.wrap} ${styles.territory}`}
      >
        <div>
          <p className={styles.eyebrow}>{t("designChapter")}</p>
          <h2 id="territory-title" className={styles.sectionTitle}>
            {t("designTerritory")}
          </h2>
        </div>
        <div className={styles.territoryDetails}>
          <Asterisk
            className={styles.territoryMark}
            aria-hidden
            strokeWidth={1.3}
          />
          <p className={styles.body}>{t("designTerritoryBody")}</p>
          <ul className={styles.municipalities}>
            {MUNICIPALITIES.map((key) => (
              <li key={key}>
                <span aria-hidden />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="experience"
        aria-labelledby="experience-title"
        className={`${styles.wrap} ${styles.experience}`}
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{t("designProduct")}</p>
            <h2 id="experience-title" className={styles.sectionTitle}>
              {t("designFeatures")}
            </h2>
          </div>
          <p className={styles.body}>{t("designFeaturesBody")}</p>
        </div>
        <div className={styles.discoveryLayout}>
          <article className={styles.discoveryPhoto}>
            <Image
              src="/places/parque-sabaneta.webp"
              alt=""
              fill
              sizes="(max-width: 800px) calc(100vw - 32px), (max-width: 1440px) 52vw, 660px"
              className={styles.townImage}
            />
            <span className={styles.townBadge}>
              <MapPin aria-hidden size={15} />
              {t("sabaneta")}
            </span>
            <div className={styles.photoFeature}>
              <MapIcon aria-hidden size={27} strokeWidth={1.5} />
              <h3>{t("mapTitle")}</h3>
              <p>{t("mapBody")}</p>
            </div>
          </article>
          <ul className={styles.discoveryFeatures}>
            {DISCOVERY_FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className={styles.featureRow}>
                <div className={styles.featureIcon}>
                  <Icon aria-hidden size={24} strokeWidth={1.5} />
                </div>
                <div>
                  <h3>{t(title)}</h3>
                  <p>{t(body)}</p>
                </div>
              </li>
            ))}
          </ul>
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
            <ArrowDownRight aria-hidden size={38} strokeWidth={1.2} />
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

      <section aria-labelledby="community-title" className={styles.community}>
        <div className={styles.wrap}>
          <div className={styles.communityLayout}>
            <div className={styles.communityIntro}>
              <p className={styles.eyebrow}>{t("designParticipation")}</p>
              <h2 id="community-title" className={styles.sectionTitle}>
                {t("designCommunity")}
              </h2>
              <p className={styles.body}>{t("designCommunityBody")}</p>
              <a href="#download" className={styles.communityAction}>
                {t("designDiscover")}
                <ArrowUpRight aria-hidden size={20} />
              </a>
            </div>
            <ul className={styles.communityFeatures}>
              {COMMUNITY_FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className={styles.featureRow}>
                  <div className={styles.featureIcon}>
                    <Icon aria-hidden size={25} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3>{t(title)}</h3>
                    <p>{t(body)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.municipal}>
            <div>
              <h3>{t("designMunicipal")}</h3>
              <p>{t("designMunicipalBody")}</p>
            </div>
            <Link href="/admin" className={styles.municipalAction}>
              {t("designMunicipalAction")}
              <ArrowUpRight aria-hidden size={19} />
            </Link>
          </div>
        </div>
      </section>

      <section
        id="download"
        aria-labelledby="download-title"
        className={`${styles.wrap} ${styles.download}`}
      >
        <div className={styles.downloadPanel}>
          <Asterisk
            aria-hidden
            className={styles.downloadMark}
            strokeWidth={1}
          />
          <div className={styles.downloadContent}>
            <p className={styles.eyebrow}>{t("brand")}</p>
            <h2 id="download-title" className={styles.downloadTitle}>
              {t("designDownload")}
            </h2>
            <p className={styles.body}>{t("designDownloadBody")}</p>
            <div className={styles.storeActions}>
              <StoreButtons
                iosUrl={site.iosUrl}
                androidUrl={site.androidUrl}
                labels={STORE_LABELS}
              />
              {!stores ? (
                <p className={styles.availability}>{t("designAvailability")}</p>
              ) : null}
            </div>
          </div>
          <div className={styles.scanCard}>
            <div className={styles.qrFrame}>
              <QrCode value={site.origin} label={t("scan")} />
              <ArrowUpRight aria-hidden size={21} />
            </div>
            <p>{t("scan")}</p>
            <p className={styles.scanHint}>{t("scanHint")}</p>
          </div>
        </div>
        <p className={styles.closingNote}>{t("designFootnote")}</p>
      </section>
    </div>
  );
}
