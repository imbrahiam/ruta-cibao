import type { Metadata } from "next";
import Image from "next/image";
import type { CSSProperties } from "react";
import { getT } from "@/lib/web/i18n";
import styles from "./page.module.css";

const t = getT("landing");
const ROOT = "/brand/proposal/";
const OPTIONS = [
  {
    id: "encuentro",
    color: "#7860a8",
    paper: "#f1edf7",
    symbol: "ruta-cibao-symbol",
    app: "ruta-cibao-app-icon",
    black: "ruta-cibao-symbol-black",
  },
  {
    id: "vinculo",
    color: "#28594a",
    paper: "#e8f0eb",
    symbol: "vinculo-symbol",
    app: "vinculo-app",
    black: "vinculo-black",
  },
  {
    id: "rumbo",
    color: "#3468d8",
    paper: "#eaf0fd",
    symbol: "rumbo-symbol",
    app: "rumbo-app",
    black: "rumbo-black",
  },
  {
    id: "plaza",
    color: "#783b57",
    paper: "#f3eaf0",
    symbol: "plaza-symbol",
    app: "plaza-app",
    black: "plaza-black",
  },
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
      <div className={styles.options}>
        {OPTIONS.map((option, index) => {
          const name = t(`brandProposal.options.${option.id}.name`);
          return (
            <section
              key={option.id}
              className={styles.option}
              aria-labelledby={`${option.id}-title`}
              style={
                {
                  "--option-color": option.color,
                  "--option-paper": option.paper,
                } as CSSProperties
              }
            >
              <div className={styles.art}>
                <span className={styles.index}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Image
                  src={`${ROOT}${option.app}.svg`}
                  alt={t("brandProposal.optionAlt", { name })}
                  width={156}
                  height={156}
                  className={styles.appIcon}
                  preload={index < 2}
                />
                <div className={styles.lockup}>
                  <Image
                    src={`${ROOT}${option.symbol}.svg`}
                    alt=""
                    width={48}
                    height={48}
                  />
                  <span>{t("brand")}</span>
                </div>
              </div>
              <div className={styles.copy}>
                <div className={styles.optionHeading}>
                  <h2 id={`${option.id}-title`}>{name}</h2>
                  <span className={styles.palette}>
                    <i />
                    {t(`brandProposal.options.${option.id}.color`)}
                  </span>
                </div>
                <p>{t(`brandProposal.options.${option.id}.body`)}</p>
                <div className={styles.sizes}>
                  {[16, 24, 32, 64].map((size) => (
                    <figure key={size}>
                      <div>
                        <Image
                          src={`${ROOT}${option.black}.svg`}
                          alt=""
                          width={size}
                          height={size}
                        />
                      </div>
                      <figcaption>
                        {t("brandProposal.size", { size })}
                      </figcaption>
                    </figure>
                  ))}
                </div>
                <nav
                  aria-label={t("brandProposal.download", { name })}
                  className={styles.downloads}
                >
                  <a href={`${ROOT}${option.symbol}.svg`} download>
                    {t("brandProposal.symbolSvg")}
                  </a>
                  <a href={`${ROOT}${option.symbol}.png`} download>
                    {t("brandProposal.symbolPng")}
                  </a>
                  <a href={`${ROOT}${option.app}.svg`} download>
                    {t("brandProposal.appSvg")}
                  </a>
                  <a href={`${ROOT}${option.app}.png`} download>
                    {t("brandProposal.appPng")}
                  </a>
                  <a href={`${ROOT}${option.black}.svg`} download>
                    {t("brandProposal.blackSvg")}
                  </a>
                  {option.id === "encuentro" ? (
                    <a href={`${ROOT}ruta-cibao-symbol-white.svg`} download>
                      {t("brandProposal.whiteSvg")}
                    </a>
                  ) : null}
                </nav>
              </div>
            </section>
          );
        })}
      </div>
      <section className={styles.comparison} aria-labelledby="compare-title">
        <h2 id="compare-title">{t("brandProposal.compareTitle")}</h2>
        <p>{t("brandProposal.compareBody")}</p>
        <div className={styles.monochrome}>
          {OPTIONS.map((option) => (
            <figure key={option.id}>
              <Image
                src={`${ROOT}${option.black}.svg`}
                alt=""
                width={112}
                height={112}
              />
              <figcaption>
                {t(`brandProposal.options.${option.id}.name`)}
              </figcaption>
            </figure>
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
