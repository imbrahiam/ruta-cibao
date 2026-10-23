import {
  FileText,
  Map as MapIcon,
  MessagesSquare,
  Route,
  Store,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import {
  AppScreenshot,
  hasScreenshot,
} from "@/components/landing/app-screenshot";
import { QrCode } from "@/components/landing/qr-code";
import { StoreButtons } from "@/components/landing/store-buttons";
import { getT } from "@/lib/web/i18n";
import { site } from "@/lib/web/site";

const t = getT("landing");

export const metadata: Metadata = {
  title: { absolute: `${t("brand")} · ${t("headline")}` },
  description: t("intro"),
  alternates: { canonical: "/" },
};

/** The screenshots the owner provides, in the order they are shown. */
const SCREENS = [
  { file: "map", label: "mapScreen" },
  { file: "explore", label: "exploreScreen" },
  { file: "place", label: "placeScreen" },
  { file: "cases", label: "casesScreen" },
] as const;

const CAPABILITIES = [
  { icon: MapIcon, title: "mapTitle", body: "mapBody" },
  { icon: Store, title: "businessTitle", body: "businessBody" },
  { icon: Route, title: "routesTitle", body: "routesBody" },
  { icon: TriangleAlert, title: "trafficTitle", body: "trafficBody" },
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
    <>
      <section className="container-page grid items-center gap-12 py-14 md:grid-cols-[1.1fr_0.9fr] md:py-24">
        <div className="animate-rise flex flex-col items-start gap-7">
          <p className="t-label text-ink-2">{t("province")}</p>
          <h1 className="t-display">{t("headline")}</h1>
          <p className="t-body-lg max-w-[46ch] text-ink-2">{t("intro")}</p>
          <div className="flex flex-col gap-3">
            <p className="t-small font-medium text-ink">{t("download")}</p>
            <StoreButtons
              iosUrl={site.iosUrl}
              androidUrl={site.androidUrl}
              labels={STORE_LABELS}
            />
            {stores ? null : (
              <p className="t-small max-w-[44ch] text-ink-3">
                {t("availability")}
              </p>
            )}
          </div>
        </div>

        <div className="hidden items-center justify-center gap-6 md:flex">
          {shown.length > 0 ? (
            <div className="flex items-start gap-5">
              {shown.slice(0, 2).map((screen, index) => (
                <div key={screen.file} className={index === 1 ? "mt-12" : ""}>
                  <AppScreenshot
                    name={screen.file}
                    screen={t(screen.label)}
                    priority
                  />
                </div>
              ))}
            </div>
          ) : (
            <ScanCard />
          )}
        </div>
      </section>

      {shown.length > 0 ? (
        <section
          aria-labelledby="screens-title"
          className="border-y border-line bg-paper-2 py-16"
        >
          <div className="container-page flex flex-col gap-10">
            <h2 id="screens-title" className="t-h2">
              {t("screenshots")}
            </h2>
            <div className="scrollbar-none -mx-5 flex gap-6 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
              {shown.map((screen) => (
                <AppScreenshot
                  key={screen.file}
                  name={screen.file}
                  screen={t(screen.label)}
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section
          aria-labelledby="screens-title"
          className="border-y border-line bg-paper-2 py-12"
        >
          <div className="container-page flex flex-col gap-2">
            <h2 id="screens-title" className="t-h3">
              {t("screenshots")}
            </h2>
            <p className="t-body max-w-[60ch] text-ink-2">
              {t("screenshotMissing")}
            </p>
          </div>
        </section>
      )}

      <section
        aria-labelledby="capabilities-title"
        className="container-page flex flex-col gap-10 py-16 md:py-24"
      >
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 id="capabilities-title" className="t-h2">
            {t("capabilities")}
          </h2>
          <p className="t-body-lg text-ink-2">{t("capabilitiesIntro")}</p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-card bg-card p-6 shadow-ring"
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  aria-hidden
                  strokeWidth={1.75}
                  className="size-5 shrink-0 text-ink"
                />
                <h3 className="t-h3">{t(title)}</h3>
              </div>
              <p className="t-body text-ink-2">{t(body)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="territory-title"
        className="bg-pine py-16 text-on-pine md:py-24"
      >
        <div className="container-page grid gap-10 md:grid-cols-2 md:items-end">
          <div className="flex flex-col gap-4">
            <h2 id="territory-title" className="t-h2">
              {t("territoryTitle")}
            </h2>
            <p className="t-body-lg max-w-[44ch] text-on-pine/80">
              {t("territoryBody")}
            </p>
          </div>
          <ul className="flex flex-wrap gap-3 md:justify-end">
            {MUNICIPALITIES.map((key) => (
              <li
                key={key}
                className="rounded-full bg-white/10 px-5 py-3 text-[17px] font-medium"
              >
                {t(key)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        id="descargar"
        aria-labelledby="download-title"
        className="container-page grid items-center gap-10 py-16 md:grid-cols-2 md:py-24"
      >
        <div className="flex flex-col gap-5">
          <h2 id="download-title" className="t-h2">
            {t("downloadTitle")}
          </h2>
          <p className="t-body-lg max-w-[46ch] text-ink-2">
            {t("downloadBody")}
          </p>
          <StoreButtons
            iosUrl={site.iosUrl}
            androidUrl={site.androidUrl}
            labels={STORE_LABELS}
          />
        </div>
        <div className="hidden justify-end md:flex">
          <ScanCard />
        </div>
      </section>
    </>
  );
}

/** Desktop only: the phone opens this very page, with its own store first. */
function ScanCard() {
  return (
    <div className="flex items-center gap-5 rounded-panel bg-card p-5 shadow-ring">
      <QrCode value={site.origin} label={t("scan")} />
      <div className="flex max-w-[16ch] flex-col gap-1.5">
        <p className="text-[16px] font-medium leading-snug">{t("scan")}</p>
        <p className="t-small text-ink-3">{t("scanHint")}</p>
      </div>
    </div>
  );
}
