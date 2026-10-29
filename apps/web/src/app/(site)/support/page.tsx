import {
  ArrowUpRight,
  ChevronRight,
  LifeBuoy,
  MessageCircle,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/lib/web/i18n";
import styles from "./page.module.css";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("support"),
  description: t("supportIntro"),
  alternates: { canonical: "/support" },
};

function SupportIllustration() {
  return (
    <div className={styles.illustration} aria-hidden="true">
      <div className={styles.orbit} />
      <div className={styles.spark}>✳</div>
      <div className={styles.accountCard}>
        <div className={styles.accountHeading}>
          <span className={styles.avatar}>
            <UserRound size={25} strokeWidth={1.5} />
          </span>
          <span>{t("supportGuide.account")}</span>
        </div>
        <div className={styles.placeholderLine} />
        <div className={styles.placeholderLine} />
        <div className={styles.supportRow}>
          <LifeBuoy size={19} strokeWidth={1.6} />
          <span>{t("supportGuide.support")}</span>
          <ChevronRight size={17} />
        </div>
      </div>
      <div className={styles.messageCard}>
        <span className={styles.messageIcon}>
          <MessageCircle size={23} strokeWidth={1.5} />
        </span>
        <p>{t("supportGuide.message")}</p>
        <div className={styles.messageLines}>
          <span />
          <span />
        </div>
        <div className={styles.sendLabel}>
          {t("supportGuide.send")}
          <Send size={14} />
        </div>
      </div>
    </div>
  );
}

export default function SupportPage() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <span
          className={`${styles.heroIcon} ${styles.emoji}`}
          aria-hidden="true"
        >
          🧭
        </span>
        <p className={styles.eyebrow}>{t("support")}</p>
        <h1>{t("supportTitle")}</h1>
        <p className={styles.heroIntro}>{t("supportGuide.intro")}</p>
      </header>

      <section className={styles.helpPanel} aria-labelledby="app-support-title">
        <div className={styles.panelTop}>
          <div className={styles.panelCopy}>
            <h2 id="app-support-title">{t("supportGuide.appTitle")}</h2>
            <p>{t("supportGuide.appBody")}</p>
            <Link href="/download" className={styles.primaryAction}>
              {t("supportGuide.getApp")}
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <SupportIllustration />
        </div>
      </section>

      <p className={styles.contactNote}>{t("supportContact")}</p>

      <section className={styles.faq} aria-labelledby="support-faq-title">
        <div className={styles.sectionHeading}>
          <h2 id="support-faq-title">
            <span
              className={`${styles.handEmoji} ${styles.emoji}`}
              aria-hidden="true"
            >
              👋
            </span>
            {t("supportGuide.faqTitle")}
          </h2>
        </div>
        <div className={styles.questions}>
          <details className={styles.question}>
            <summary>
              {t("supportGuide.faqAccessTitle")}
              <span className={styles.toggle} aria-hidden="true" />
            </summary>
            <div className={styles.answer}>
              <p>{t("supportGuide.faqAccessBody")}</p>
            </div>
          </details>
          <details className={styles.question}>
            <summary>
              {t("supportGuide.faqPlaceTitle")}
              <span className={styles.toggle} aria-hidden="true" />
            </summary>
            <div className={styles.answer}>
              <p>{t("supportGuide.faqPlaceBody")}</p>
            </div>
          </details>
          <details className={styles.question}>
            <summary>
              {t("supportGuide.faqRoutesTitle")}
              <span className={styles.toggle} aria-hidden="true" />
            </summary>
            <div className={styles.answer}>
              <p>{t("supportGuide.faqRoutesBody")}</p>
            </div>
          </details>
          <details className={styles.question}>
            <summary>
              {t("supportGuide.faqPrivacyTitle")}
              <span className={styles.toggle} aria-hidden="true" />
            </summary>
            <div className={styles.answer}>
              <p>{t("supportGuide.faqPrivacyBody")}</p>
              <Link href="/account/delete" className={styles.textAction}>
                {t("supportGuide.privacyAction")}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </details>
        </div>
      </section>

      <aside className={styles.explore} aria-labelledby="support-explore-title">
        <div>
          <h2 id="support-explore-title">{t("supportGuide.exploreTitle")}</h2>
          <p>{t("supportGuide.exploreBody")}</p>
        </div>
        <Link href="/experience" className={styles.secondaryAction}>
          {t("supportGuide.exploreAction")}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </aside>

      <aside className={styles.safety} aria-labelledby="support-safety-title">
        <ShieldCheck size={19} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h2 id="support-safety-title">{t("supportSafetyTitle")}</h2>
          <p>{t("supportSafety")}</p>
        </div>
      </aside>
    </div>
  );
}
