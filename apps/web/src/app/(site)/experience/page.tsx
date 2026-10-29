import { FileText, MapPin, MessagesSquare, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import {
  CommunityConcept,
  LocalConcept,
  RoutesConcept,
} from "@/components/landing/concept-visual";
import { PublicPage } from "@/components/site/public-page";
import styles from "@/components/site/public-page.module.css";
import { getT } from "@/lib/web/i18n";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("pages.experience"),
  description: t("pages.experienceDescription"),
  alternates: { canonical: "/experience" },
};

export default function ExperiencePage() {
  return (
    <PublicPage
      current="experience"
      eyebrow={t("pages.experienceEyebrow")}
      title={t("pages.experienceTitle")}
      intro={t("pages.experienceIntro")}
    >
      <section className={styles.split} aria-labelledby="places-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{t("pages.experienceMapEyebrow")}</p>
          <h2 id="places-title">{t("pages.experienceMapTitle")}</h2>
          <p className={styles.body}>{t("pages.experienceMapBody")}</p>
          <p className={styles.detail}>
            <MapPin aria-hidden="true" size={17} />
            <span>{t("pages.experienceMapDetail")}</span>
          </p>
        </div>
        <LocalConcept />
      </section>

      <section
        className={`${styles.split} ${styles.reverse}`}
        aria-labelledby="routes-title"
      >
        <RoutesConcept />
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{t("pages.experienceRoutesEyebrow")}</p>
          <h2 id="routes-title">{t("pages.experienceRoutesTitle")}</h2>
          <p className={styles.body}>{t("pages.experienceRoutesBody")}</p>
          <p className={styles.detail}>
            <TriangleAlert aria-hidden="true" size={17} />
            <span>{t("pages.experienceRoutesDetail")}</span>
          </p>
        </div>
      </section>

      <section className={styles.split} aria-labelledby="community-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            {t("pages.experienceCommunityEyebrow")}
          </p>
          <h2 id="community-title">{t("pages.experienceCommunityTitle")}</h2>
          <p className={styles.body}>{t("pages.experienceCommunityBody")}</p>
          <div className={styles.features}>
            <article className={styles.feature}>
              <MessagesSquare aria-hidden="true" size={22} strokeWidth={1.5} />
              <h3>{t("casesTitle")}</h3>
              <p>{t("casesBody")}</p>
            </article>
            <article className={styles.feature}>
              <FileText aria-hidden="true" size={22} strokeWidth={1.5} />
              <h3>{t("reportsTitle")}</h3>
              <p>{t("reportsBody")}</p>
            </article>
          </div>
        </div>
        <CommunityConcept />
      </section>
      <p className={styles.notice}>{t("pages.experienceNotice")}</p>
    </PublicPage>
  );
}
