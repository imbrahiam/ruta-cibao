import { MapPin, MessagesSquare, Route } from "lucide-react";
import type { Metadata } from "next";
import { RouteHeadline } from "@/components/landing/rotating-headline";
import { PublicPage, PublicPageAction } from "@/components/site/public-page";
import styles from "@/components/site/public-page.module.css";
import { getT } from "@/lib/web/i18n";

const t = getT("landing");

export const metadata: Metadata = {
  title: t("pages.territory"),
  description: t("pages.territoryDescription"),
  alternates: { canonical: "/territory" },
};

/** Original editorial motifs, deliberately not geographic representations. */
function MunicipalityPortrait({
  kind,
}: {
  kind: "place" | "path" | "community";
}) {
  return (
    <div className={styles.portrait} aria-hidden="true">
      <svg viewBox="0 0 360 230" fill="none" aria-hidden="true">
        <circle
          cx="180"
          cy="115"
          r="88"
          stroke="#ffffff"
          strokeOpacity="0.65"
        />
        <circle
          cx="180"
          cy="115"
          r="109"
          stroke="#ffffff"
          strokeOpacity="0.45"
        />
        {kind === "place" ? (
          <>
            <circle cx="253" cy="66" r="19" fill="#f5e6aa" />
            <path
              d="M77 188h211"
              stroke="#b5c3a6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M118 187V108a62 62 0 0 1 124 0v79" fill="#fafbf5" />
            <path d="M143 187v-77a37 37 0 0 1 74 0v77" fill="#b1c09e" />
            <path
              d="M174 186v-55a23 23 0 0 1 43 0"
              stroke="#7a8c6b"
              strokeWidth="2"
            />
            <path
              d="M90 187v-46m0 24c-21 0-28-14-28-28 18 0 28 9 28 28Zm0-10c20 0 29-16 29-30-19 0-29 10-29 30Z"
              fill="#a4b493"
            />
            <rect x="78" y="177" width="25" height="12" rx="3" fill="#d8cfb5" />
            <path
              d="M245 187h25"
              stroke="#7a8c6b"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </>
        ) : kind === "path" ? (
          <>
            <circle cx="102" cy="70" r="19" fill="#f7f3e7" />
            <path
              d="M146 250c-55-51 124-70 73-118-32-30-100-14-80-55 10-21 42-29 57-48"
              stroke="#faf8fc"
              strokeWidth="42"
            />
            <path
              d="M146 250c-55-51 124-70 73-118-32-30-100-14-80-55 10-21 42-29 57-48"
              stroke="#9e8db4"
              strokeWidth="2"
              strokeDasharray="4 8"
              strokeLinecap="round"
            />
            <circle
              cx="207"
              cy="163"
              r="10"
              fill="#a698ba"
              stroke="#fff"
              strokeWidth="4"
            />
            <path d="m243 69 15-7-5 16-3-9-7 0Z" fill="#8d7caa" />
            <path
              d="M82 178h30m-15-15v30M264 135h18m-9-9v18"
              stroke="#b8acca"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <rect
              x="77"
              y="57"
              width="143"
              height="97"
              rx="15"
              fill="#fffaf0"
              transform="rotate(-8 77 57)"
            />
            <path
              d="m99 85 76-11m-72 29 55-8m-51 26 70-10"
              stroke="#d7cba9"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <rect
              x="155"
              y="95"
              width="119"
              height="85"
              rx="15"
              fill="#c0cba9"
              transform="rotate(8 155 95)"
            />
            <path
              d="m182 123 61 9m-64 9 44 7"
              stroke="#f9fbf3"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path d="m174 177-9 17 27-13" fill="#c0cba9" />
            <circle cx="263" cy="64" r="13" fill="#d8c7df" />
            <path
              d="m83 180 6 6 13-15"
              stroke="#a49a7d"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>
    </div>
  );
}

const MUNICIPALITIES = [
  {
    name: "sabaneta",
    headline: "territorySabaneta",
    body: "territorySabanetaBody",
    kind: "place",
  },
  {
    name: "moncion",
    headline: "territoryMoncion",
    body: "territoryMoncionBody",
    kind: "path",
  },
  {
    name: "almacigos",
    headline: "territoryAlmacigos",
    body: "territoryAlmacigosBody",
    kind: "community",
  },
] as const;

export default function TerritoryPage() {
  return (
    <PublicPage
      current="territory"
      title={
        <RouteHeadline
          firstLine={t("pages.territoryHeadingFirst")}
          lead={t("pages.territoryHeadingLead")}
          phrases={[
            t("pages.territoryHeadingWordOne"),
            t("pages.territoryHeadingWordTwo"),
            t("pages.territoryHeadingWordThree"),
          ]}
          tone="lavender"
        />
      }
      intro={t("pages.territoryIntro")}
    >
      <div className={styles.municipalities}>
        {MUNICIPALITIES.map((municipality) => (
          <article className={styles.municipality} key={municipality.name}>
            <MunicipalityPortrait kind={municipality.kind} />
            <div className={styles.municipalityCopy}>
              <p className={styles.municipalityName}>
                <MapPin aria-hidden="true" size={14} />
                {t(municipality.name)}
              </p>
              <h2>{t(`studio.${municipality.headline}`)}</h2>
              <p>{t(`pages.${municipality.body}`)}</p>
            </div>
          </article>
        ))}
      </div>

      <section className={styles.shared} aria-labelledby="shared-title">
        <div>
          <h2 id="shared-title">{t("pages.territorySharedTitle")}</h2>
          <p className={styles.body}>{t("pages.territorySharedBody")}</p>
          <PublicPageAction href="/experience">
            {t("studio.explore")}
          </PublicPageAction>
        </div>
        <ul className={styles.sharedList}>
          <li>
            <MapPin aria-hidden="true" size={22} strokeWidth={1.5} />
            {t("pages.territoryPlaces")}
          </li>
          <li>
            <Route aria-hidden="true" size={22} strokeWidth={1.5} />
            {t("pages.territoryRoutes")}
          </li>
          <li>
            <MessagesSquare aria-hidden="true" size={22} strokeWidth={1.5} />
            {t("pages.territoryCommunity")}
          </li>
        </ul>
      </section>
    </PublicPage>
  );
}
