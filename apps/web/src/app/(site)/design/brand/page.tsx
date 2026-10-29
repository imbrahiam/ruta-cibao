import type { Metadata } from "next";
import Image from "next/image";
import { getT } from "@/lib/web/i18n";
import styles from "./page.module.css";

const t = getT("landing");
const ROOT = "/brand/proposal/";
const FILES = [
  ["symbolSvg", "ruta-cibao-symbol.svg"],
  ["symbolPng", "ruta-cibao-symbol.png"],
  ["appSvg", "ruta-cibao-app-icon.svg"],
  ["appPng", "ruta-cibao-app-icon.png"],
  ["blackSvg", "ruta-cibao-symbol-black.svg"],
  ["whiteSvg", "ruta-cibao-symbol-white.svg"],
] as const;
const REFERENCES = [
  [
    "instagram",
    "https://www.meta.com/brand/resources/instagram/instagram-brand/",
  ],
  ["x", "https://x.com/"],
  ["threads", "https://www.meta.com/brand/resources/threads/"],
  ["bluesky", "https://bsky.social/about/support/icons"],
] as const;

export const metadata: Metadata = {
  title: t("brandProposal.title"),
  description: t("brandProposal.intro"),
  robots: { index: false, follow: false },
  alternates: { canonical: "/design/brand" },
};

export default function BrandProposalPage() {
  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <p className={styles.status}>{t("brandProposal.status")}</p>
        <h1>{t("brandProposal.title")}</h1>
        <p>{t("brandProposal.intro")}</p>
      </header>
      <section className={styles.identity} aria-labelledby="identity-title">
        <div className={styles.lockup}>
          <Image
            src={`${ROOT}ruta-cibao-symbol.svg`}
            alt={t("brandProposal.symbolAlt")}
            width={192}
            height={192}
            preload
          />
          <span>{t("brand")}</span>
        </div>
        <div className={styles.identityCopy}>
          <h2 id="identity-title">{t("brandProposal.conceptTitle")}</h2>
          <p>{t("brandProposal.conceptBody")}</p>
        </div>
      </section>
      <section aria-labelledby="app-title" className={styles.section}>
        <h2 id="app-title">{t("brandProposal.appTitle")}</h2>
        <p>{t("brandProposal.appBody")}</p>
        <div className={styles.variants}>
          {(
            [
              ["iris", "ruta-cibao-app-icon.svg"],
              ["ink", "ruta-cibao-symbol-black.svg"],
              ["reverse", "ruta-cibao-symbol-white.svg"],
            ] as const
          ).map(([name, file]) => (
            <figure
              key={name}
              className={name === "reverse" ? styles.dark : styles.light}
            >
              <Image
                src={`${ROOT}${file}`}
                alt=""
                width={180}
                height={180}
                className={name === "iris" ? styles.appIcon : undefined}
              />
              <figcaption>{t(`brandProposal.${name}`)}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="small-title">
        <h2 id="small-title">{t("brandProposal.smallTitle")}</h2>
        <p>{t("brandProposal.smallBody")}</p>
        <div className={styles.sizes}>
          {[16, 24, 32, 64].map((size) => (
            <figure key={size}>
              <div>
                <Image
                  src={`${ROOT}ruta-cibao-symbol-black.svg`}
                  alt=""
                  width={size}
                  height={size}
                />
              </div>
              <figcaption>{t("brandProposal.size", { size })}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-labelledby="files-title">
        <h2 id="files-title">{t("brandProposal.filesTitle")}</h2>
        <div className={styles.downloads}>
          {FILES.map(([label, file]) => (
            <a href={`${ROOT}${file}`} download key={file}>
              {t(`brandProposal.${label}`)}
            </a>
          ))}
        </div>
      </section>
      <section className={styles.references} aria-labelledby="references-title">
        <h2 id="references-title">{t("brandProposal.referencesTitle")}</h2>
        <p>{t("brandProposal.referencesBody")}</p>
        <ul>
          {REFERENCES.map(([label, href]) => (
            <li key={label}>
              <a href={href} rel="noopener noreferrer">
                {t(`brandProposal.${label}`)}
              </a>
            </li>
          ))}
        </ul>
        <p className={styles.notice}>{t("brandProposal.notice")}</p>
      </section>
    </div>
  );
}
