import {
  ArrowUpRight,
  Footprints,
  Map as MapIcon,
  MessagesSquare,
  Search,
  Stamp,
  Store,
  TrafficCone,
  TriangleAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LandingMap } from "@/components/landing/landing-map";
import { PlacesScroller } from "@/components/landing/places-scroller";
import { PlaceCard } from "@/components/places/place-card";
import { SiteFooter } from "@/components/shell/site-footer";
import { TabBar } from "@/components/shell/tab-bar";
import { TopNav } from "@/components/shell/top-nav";
import { ButtonLink } from "@/components/ui/button";
import { TIME_ZONE } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import { landingPlaces, landingPulse } from "@/modules/landing/overview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: { absolute: `${t("name")} · ${t("tagline")}` } };
}

const TIME_FORMAT = new Intl.DateTimeFormat("es-DO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

/**
 * The six things the app is for, in the order a visitor meets them. The first
 * two are the ones the page leads with, so they get the photograph and the
 * pine surface; the rest are a row of quiet cards.
 */
const FEATURES = [
  { key: "routes", icon: Footprints, href: "/rutas" },
  { key: "consultations", icon: MessagesSquare, href: "/consultas" },
  { key: "passport", icon: Stamp, href: "/pasaporte" },
  { key: "business", icon: Store, href: "/explorar" },
] as const;

/**
 * The front door: the province first as a place, then as a live service.
 * A photograph carries the emotion, the search answers the question in the
 * headline, and every section after it earns its space with real data or a
 * concrete task.
 */
export default async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <TopNav />
      <main id="contenido" className="flex-1">
        <section className="container-page pt-3 pb-12 md:pt-6 md:pb-20">
          <div className="relative isolate flex min-h-[380px] items-center justify-center overflow-hidden rounded-frame bg-pine px-5 py-14 text-center md:min-h-[540px] md:px-12">
            <Image
              src="/places/presa-moncion.webp"
              alt={t("photoAlt")}
              fill
              preload
              sizes="(min-width: 1200px) 1152px, calc(100vw - 32px)"
              className="-z-20 object-cover object-[50%_45%] saturate-[.9]"
            />
            <div
              aria-hidden
              className="-z-10 absolute inset-0 bg-[linear-gradient(to_top,rgb(18_18_17/.8),rgb(18_18_17/.56)_48%,rgb(18_18_17/.44))]"
            />
            <div className="max-w-[720px] text-on-pine">
              <p className="t-label text-on-pine/85">{t("region")}</p>
              <h1 className="t-display mt-4 text-[clamp(38px,6.5vw,78px)] text-on-pine [text-shadow:0_2px_28px_rgb(18_18_17/.3)]">
                {t("question")}
              </h1>
              <p className="t-body-lg mx-auto mt-4 max-w-[46ch] text-on-pine/85">
                {t("lede")}
              </p>
            </div>
          </div>

          <div className="relative z-10 mx-auto -mt-7 max-w-[680px] px-3 md:-mt-8">
            <search>
              <form
                action="/explorar"
                className="flex h-14 items-center gap-2 rounded-full bg-card pr-1.5 pl-5 shadow-lg md:h-16 md:pr-2 md:pl-6"
              >
                <Search
                  strokeWidth={1.5}
                  className="size-5 shrink-0 text-ink-3"
                  aria-hidden
                />
                <label htmlFor="landing-search" className="sr-only">
                  {t("search")}
                </label>
                <input
                  id="landing-search"
                  type="search"
                  name="q"
                  enterKeyHint="search"
                  maxLength={100}
                  placeholder={t("searchPlaceholder")}
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
                />
                <button
                  type="submit"
                  className="press h-11 shrink-0 rounded-full bg-accent px-5 text-[15px] font-medium text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 md:h-12 md:px-6"
                >
                  {t("searchSubmit")}
                </button>
              </form>
            </search>

            <nav
              aria-label={t("tasks")}
              className="mt-4 flex flex-wrap justify-center gap-3"
            >
              <ButtonLink href="/mapa" variant="accent" size="lg">
                <MapIcon strokeWidth={1.5} className="size-4.5" />
                {t("openMap")}
              </ButtonLink>
              <ButtonLink
                href="/mapa?reportar=transito"
                variant="secondary"
                size="lg"
              >
                <TriangleAlert strokeWidth={1.5} className="size-4.5" />
                {t("report")}
              </ButtonLink>
            </nav>
          </div>

          <Suspense fallback={<div className="mt-8 h-9" />}>
            <HeroFacts />
          </Suspense>
        </section>

        <section className="container-page py-12 md:py-20">
          <div className="max-w-[620px]">
            <p className="t-label text-ink-3">{t("features.eyebrow")}</p>
            <h2 className="t-h2 mt-3">{t("features.title")}</h2>
            <p className="t-body-lg mt-3 text-ink-2">{t("features.lede")}</p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-4 md:gap-4">
            <Link
              href="/mapa"
              className="group relative isolate col-span-2 flex min-h-[248px] flex-col justify-end overflow-hidden rounded-panel bg-pine p-6 text-on-pine focus-visible:outline-2 focus-visible:outline-offset-4 md:col-span-3 md:min-h-[320px] md:p-8"
            >
              <Image
                src="/places/parque-sabaneta.webp"
                alt=""
                fill
                sizes="(min-width: 810px) 760px, 100vw"
                className="-z-20 object-cover object-[50%_58%] transition-transform duration-700 motion-safe:group-hover:scale-[1.03]"
              />
              <div
                aria-hidden
                className="-z-10 absolute inset-0 bg-[linear-gradient(to_top,rgb(18_18_17/.94),rgb(18_18_17/.62)_46%,rgb(18_18_17/.08))]"
              />
              <h3 className="t-h2 text-[26px] text-on-pine md:text-[32px]">
                {t("features.items.discover.title")}
              </h3>
              <p className="t-small mt-2 max-w-[40ch] text-on-pine/90">
                {t("features.items.discover.body")}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-on-pine">
                {t("features.items.discover.action")}
                <ArrowUpRight strokeWidth={2} className="size-4" aria-hidden />
              </span>
            </Link>

            <Link
              href="/mapa?reportar=transito"
              className="group col-span-2 flex flex-col justify-between rounded-panel bg-pine p-6 text-on-pine focus-visible:outline-2 focus-visible:outline-offset-4 md:col-span-1 md:p-7"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-white/8 text-on-pine ring-1 ring-white/15">
                <TrafficCone strokeWidth={1.5} className="size-5" aria-hidden />
              </span>
              <div className="mt-6">
                <h3 className="t-h3 text-on-pine">
                  {t("features.items.traffic.title")}
                </h3>
                <p className="t-small mt-2 text-on-pine/75">
                  {t("features.items.traffic.body")}
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-medium text-on-pine">
                {t("features.items.traffic.action")}
                <ArrowUpRight strokeWidth={2} className="size-4" aria-hidden />
              </span>
            </Link>

            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.key}
                  href={feature.href}
                  className="group relative flex flex-col rounded-panel bg-card p-5 shadow-ring transition-shadow duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <span className="flex size-10 items-center justify-center rounded-full bg-paper-2 text-ink-2 transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                    <Icon
                      strokeWidth={1.5}
                      className="size-[18px]"
                      aria-hidden
                    />
                  </span>
                  <h3 className="t-h3 mt-4 text-[17px] md:text-[19px]">
                    {t(`features.items.${feature.key}.title`)}
                  </h3>
                  <p className="t-small mt-1.5 hidden text-ink-2 md:block">
                    {t(`features.items.${feature.key}.body`)}
                  </p>
                  <ArrowUpRight
                    strokeWidth={1.75}
                    aria-hidden
                    className="absolute top-5 right-5 size-4 text-ink-4 transition-colors group-hover:text-ink"
                  />
                </Link>
              );
            })}
          </div>
        </section>

        <Suspense fallback={<div className="h-[640px] bg-paper-2" />}>
          <RoadsSection />
        </Suspense>

        <Suspense fallback={null}>
          <PlacesSection />
        </Suspense>

        <section className="container-page py-12 md:py-20">
          <div className="flex flex-col items-start gap-7 rounded-panel bg-pine p-7 text-on-pine shadow-sm md:flex-row md:items-center md:justify-between md:p-10">
            <div className="flex items-start gap-4">
              <LogoMark className="size-12 rounded-[14px] ring-1 ring-white/15" />
              <div>
                <h2 className="t-h2 text-on-pine">{t("install.title")}</h2>
                <p className="t-body mt-2 max-w-[46ch] text-on-pine/75">
                  {t("install.body")}
                </p>
              </div>
            </div>
            <Link
              href="/instalar"
              className="press inline-flex min-h-12 shrink-0 items-center rounded-full bg-card px-5 text-[15px] font-medium text-ink hover:bg-paper-2"
            >
              {t("install.action")}
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <TabBar />
    </div>
  );
}

/**
 * Three facts, one of which moves. A number that is zero says the province is
 * empty, so each fact only appears once there is something to count.
 */
async function HeroFacts() {
  const t = await getTranslations("landing");
  const pulse = await landingPulse();
  const blocking = pulse.open.filter((report) => report.blocking).length;

  return (
    <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[14px] text-ink-2">
      {pulse.places > 0 ? (
        <li className="flex items-baseline gap-1.5">
          <span className="font-mono text-[15px] text-ink tabular">
            {pulse.places}
          </span>
          {t("stats.places", { count: pulse.places })}
        </li>
      ) : null}
      {pulse.municipalities > 0 ? (
        <>
          <li aria-hidden className="size-1 rounded-full bg-ink-4" />
          <li className="flex items-baseline gap-1.5">
            <span className="font-mono text-[15px] text-ink tabular">
              {pulse.municipalities}
            </span>
            {t("stats.municipalities", { count: pulse.municipalities })}
          </li>
        </>
      ) : null}
      <li>
        <a
          href="#vias"
          className="press inline-flex items-center gap-2 rounded-full bg-paper-2 py-1.5 pr-3.5 pl-2.5 text-ink-2 hover:bg-paper-3 hover:text-ink"
        >
          <span
            aria-hidden
            className={
              blocking
                ? "size-2 rounded-full bg-danger"
                : "size-2 rounded-full bg-success"
            }
          />
          {pulse.open.length
            ? t("pulseShort", { count: pulse.open.length })
            : t("pulseClear")}
        </a>
      </li>
    </ul>
  );
}

async function RoadsSection() {
  const t = await getTranslations("landing");
  const pulse = await landingPulse();
  const blocking = pulse.open.filter((report) => report.blocking).length;
  return (
    <section id="vias" className="scroll-mt-24 bg-paper-2">
      <div className="container-page py-12 md:py-20">
        <div className="max-w-[680px]">
          <p className="t-label text-ink-3">{t("territory.eyebrow")}</p>
          <h2 className="t-h2 mt-3">{t("territory.title")}</h2>
          <p className="t-body-lg mt-3 text-ink-2">{t("territory.lede")}</p>
        </div>

        <div className="mt-8 grid items-start gap-4 md:mt-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)] lg:gap-6">
          <figure className="rounded-frame bg-card p-3 shadow-sm">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-paper">
              <LandingMap />
              <figcaption className="glass pointer-events-none absolute bottom-3 left-3 z-10 flex items-center gap-2.5 rounded-full py-2 pr-4 pl-2.5 text-[14px] text-ink">
                <span
                  className={
                    blocking
                      ? "size-2 rounded-full bg-danger"
                      : "size-2 rounded-full bg-success"
                  }
                  aria-hidden
                />
                {pulse.open.length
                  ? t("pulse", { count: pulse.open.length, blocking })
                  : t("pulseClear")}
              </figcaption>
            </div>
          </figure>

          <div className="rounded-panel bg-card p-6 shadow-ring md:p-8">
            <h3 className="t-h3">{t("roads.title")}</h3>
            <p className="t-body mt-2.5 text-ink-2">{t("roads.lede")}</p>
            <dl className="mt-6 divide-y divide-line/70 border-y border-line/70">
              {[
                [pulse.open.length, t("roads.open")],
                [blocking, t("roads.blocking")],
                [pulse.resolvedThisWeek, t("roads.resolvedWeek")],
              ].map(([value, label]) => (
                <div
                  key={String(label)}
                  className="flex min-h-13 items-center justify-between gap-6 py-3"
                >
                  <dt className="t-small text-ink-2">{label}</dt>
                  <dd className="font-mono text-[22px] leading-none text-ink tabular">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {pulse.blocked.length === 0 ? (
              <p className="t-small mt-5 flex items-center gap-2.5 text-ink-2">
                <span className="size-2 rounded-full bg-success" aria-hidden />
                {t("roads.noneBlocked")}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line/60">
                {pulse.blocked.slice(0, 3).map((report) => (
                  <li key={report.id}>
                    <Link
                      href={`/mapa?reporte=${report.id}`}
                      className="flex min-h-14 items-center gap-3 py-2.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-input bg-danger text-white">
                        <TrafficCone strokeWidth={1.75} className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] text-ink">
                          {report.category}
                        </span>
                        <span className="t-small block text-ink-3">
                          {report.municipality}
                        </span>
                      </span>
                      <span className="t-small shrink-0 text-ink-3">
                        {TIME_FORMAT.format(new Date(report.createdAt))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <ButtonLink
              href="/mapa?reportar=transito"
              variant="primary"
              className="mt-6"
            >
              {t("roads.report")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

async function PlacesSection() {
  const t = await getTranslations("landing");
  const places = await landingPlaces();
  if (!places.length) return null;

  return (
    <section className="mx-auto max-w-[1200px] py-12 md:py-20">
      <PlacesScroller
        heading={
          <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-3">
            <div>
              <p className="t-label text-ink-3">{t("places.eyebrow")}</p>
              <h2 className="t-h2 mt-3">{t("places.title")}</h2>
            </div>
            <Link
              href="/explorar"
              className="t-small pb-1.5 font-medium text-accent hover:text-accent-hover"
            >
              {t("places.all")}
            </Link>
          </div>
        }
      >
        {places.slice(0, 8).map((place) => (
          <li
            key={place.id}
            className="flex w-[78vw] max-w-[320px] shrink-0 snap-start [&>a]:w-full"
          >
            <PlaceCard place={place} />
          </li>
        ))}
      </PlacesScroller>
    </section>
  );
}
