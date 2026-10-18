import {
  ChevronRight,
  Compass,
  Footprints,
  MessagesSquare,
  Stamp,
  Store,
  TrafficCone,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LandingMap } from "@/components/landing/landing-map";
import { Territory } from "@/components/landing/territory";
import { PlaceCard } from "@/components/places/place-card";
import { SiteFooter } from "@/components/shell/site-footer";
import { TabBar } from "@/components/shell/tab-bar";
import { TopNav } from "@/components/shell/top-nav";
import { ButtonLink } from "@/components/ui/button";
import { TIME_ZONE } from "@/i18n/config";
import { Link } from "@/i18n/navigation";
import {
  landingPlaces,
  landingPulse,
  landingTerritory,
} from "@/modules/landing/overview";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return { title: { absolute: `${t("name")} · ${t("tagline")}` } };
}

const TIME_FORMAT = new Intl.DateTimeFormat("es-DO", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

const FEATURES = [
  { key: "discover", icon: Compass, href: "/mapa" },
  { key: "traffic", icon: TrafficCone, href: "/mapa?reportar=transito" },
  { key: "routes", icon: Footprints, href: "/rutas" },
  { key: "consultations", icon: MessagesSquare, href: "/consultas" },
  { key: "passport", icon: Stamp, href: "/pasaporte" },
  { key: "business", icon: Store, href: "/explorar" },
] as const;

/**
 * The front door. One orchestrated moment (the hero rising over the live map)
 * and then quiet sections, each saying one thing with real data: what you can
 * do, how the roads are right now, places worth the trip, and the territory.
 */
export default async function LandingPage() {
  const t = await getTranslations("landing");

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <TopNav />
      <main id="contenido" className="flex-1">
        <section className="container-page pt-8 pb-16 md:pt-16 md:pb-24">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
            <div className="stagger">
              <p className="t-label inline-flex rounded-full bg-paper-3 px-2.5 pt-[5px] pb-1.5 text-ink-2">
                {t("eyebrow")}
              </p>
              <h1 className="t-display mt-5 text-ink">{t("title")}</h1>
              <p className="t-body-lg mt-5 max-w-[44ch] text-ink-2">
                {t("lede")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink href="/mapa" variant="accent" size="lg">
                  {t("openMap")}
                </ButtonLink>
                <ButtonLink href="/explorar" variant="secondary" size="lg">
                  {t("explore")}
                </ButtonLink>
              </div>
              <Suspense fallback={<div className="mt-10 h-14" />}>
                <HeroStats />
              </Suspense>
            </div>
            <figure className="rounded-frame bg-paper-2 p-3 animate-rise [animation-delay:120ms]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-paper-2 shadow-ring">
                <LandingMap />
                <Suspense fallback={null}>
                  <HeroPulse />
                </Suspense>
              </div>
            </figure>
          </div>
        </section>

        <section className="container-page py-16 md:py-24">
          <div className="max-w-[640px]">
            <p className="t-label text-ink-3">{t("features.eyebrow")}</p>
            <h2 className="t-h2 mt-3">{t("features.title")}</h2>
            <p className="t-body-lg mt-3 text-ink-2">{t("features.lede")}</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.key}>
                  <Link
                    href={feature.href}
                    className="group flex h-full flex-col rounded-card bg-card p-6 shadow-ring transition-shadow duration-200 hover:shadow-md"
                  >
                    <span className="flex size-11 items-center justify-center rounded-full bg-paper-2 text-ink-2 transition-colors group-hover:bg-accent-soft group-hover:text-accent">
                      <Icon strokeWidth={1.5} className="size-5" />
                    </span>
                    <span className="t-h3 mt-5 text-ink">
                      {t(`features.items.${feature.key}.title`)}
                    </span>
                    <span className="t-body mt-2 text-ink-2">
                      {t(`features.items.${feature.key}.body`)}
                    </span>
                    <span className="t-small mt-auto inline-flex items-center gap-1 pt-5 font-medium text-ink">
                      {t(`features.items.${feature.key}.action`)}
                      <ChevronRight
                        strokeWidth={1.5}
                        className="size-4 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <Suspense fallback={<div className="h-96 bg-paper-2" />}>
          <RoadsSection />
        </Suspense>

        <Suspense fallback={null}>
          <PlacesSection />
        </Suspense>

        <section className="container-page grid items-center gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="t-label text-ink-3">{t("territory.eyebrow")}</p>
            <h2 className="t-h2 mt-3">{t("territory.title")}</h2>
            <p className="t-body-lg mt-3 max-w-[48ch] text-ink-2">
              {t("territory.lede")}
            </p>
          </div>
          <div className="rounded-frame bg-paper-2 p-6 md:p-10">
            <Suspense fallback={<div className="aspect-square" />}>
              <TerritoryMap label={t("territory.label")} />
            </Suspense>
          </div>
        </section>

        <section className="container-page pb-[calc(var(--tabbar-h)+32px)] md:pb-24">
          <div className="flex flex-col items-start gap-6 rounded-panel bg-[#121211] p-8 text-[#f3f2ee] md:flex-row md:items-center md:justify-between md:p-12 dark:shadow-ring">
            <div className="flex items-start gap-4">
              <LogoMark className="size-12 rounded-[14px] ring-1 ring-white/15" />
              <div>
                <h2 className="t-h3">{t("install.title")}</h2>
                <p className="t-body mt-1 max-w-[46ch] text-[#b4b1a8]">
                  {t("install.body")}
                </p>
              </div>
            </div>
            <Link
              href="/instalar"
              className="press inline-flex h-12 shrink-0 items-center rounded-full bg-[#f3f2ee] px-5 text-[15px] font-medium text-[#121211] hover:opacity-90"
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

async function HeroStats() {
  const t = await getTranslations("landing");
  const pulse = await landingPulse();
  return (
    <dl className="mt-10 grid max-w-md grid-cols-3 items-start gap-6">
      {[
        [pulse.places, t("stats.places", { count: pulse.places })],
        [pulse.routes, t("stats.routes", { count: pulse.routes })],
        [
          pulse.resolvedThisMonth,
          t("stats.resolved", { count: pulse.resolvedThisMonth }),
        ],
      ].map(([value, label]) => (
        <div key={String(label)} className="flex flex-col-reverse justify-end">
          <dt className="t-small mt-1 text-ink-3">{label}</dt>
          <dd className="font-mono text-[28px] leading-none tracking-[-0.02em] text-ink tabular">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function HeroPulse() {
  const t = await getTranslations("landing");
  const pulse = await landingPulse();
  const blocking = pulse.open.filter((report) => report.blocking).length;
  return (
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
  );
}

async function RoadsSection() {
  const t = await getTranslations("landing");
  const pulse = await landingPulse();
  const blocking = pulse.open.filter((report) => report.blocking).length;
  return (
    <section className="bg-paper-2">
      <div className="container-page grid gap-10 py-16 md:py-24 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="t-label text-ink-3">{t("roads.eyebrow")}</p>
          <h2 className="t-h2 mt-3">{t("roads.title")}</h2>
          <p className="t-body-lg mt-3 max-w-[48ch] text-ink-2">
            {t("roads.lede")}
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {[
              [pulse.open.length, t("roads.open")],
              [blocking, t("roads.blocking")],
              [pulse.resolvedThisWeek, t("roads.resolvedWeek")],
            ].map(([value, label]) => (
              <div
                key={String(label)}
                className="flex flex-col-reverse rounded-card bg-card p-4 shadow-ring"
              >
                <dt className="t-small mt-1 text-ink-3">{label}</dt>
                <dd className="font-mono text-[28px] leading-none text-ink tabular">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <ButtonLink
            href="/mapa?reportar=transito"
            variant="primary"
            className="mt-8"
          >
            {t("roads.report")}
          </ButtonLink>
        </div>
        <div>
          <h3 className="t-label text-ink-3">{t("roads.blockedTitle")}</h3>
          {pulse.blocked.length === 0 ? (
            <p className="t-body mt-4 rounded-card bg-card p-5 text-ink-2 shadow-ring">
              {t("roads.noneBlocked")}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line/60 overflow-hidden rounded-card bg-card shadow-ring">
              {pulse.blocked.map((report) => (
                <li key={report.id}>
                  <Link
                    href={`/mapa?reporte=${report.id}`}
                    className="flex items-center gap-3 px-5 py-4 hover:bg-paper-2"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-danger text-white">
                      <TrafficCone strokeWidth={2} className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] text-ink">
                        {report.category}
                      </span>
                      <span className="t-small block text-ink-3">
                        {report.municipality}
                      </span>
                    </span>
                    <span className="t-small text-ink-3">
                      {TIME_FORMAT.format(new Date(report.createdAt))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

async function PlacesSection() {
  const t = await getTranslations("landing");
  const places = await landingPlaces();
  return (
    <>
      {places.length ? (
        <section className="container-page py-16 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-[640px]">
              <p className="t-label text-ink-3">{t("places.eyebrow")}</p>
              <h2 className="t-h2 mt-3">{t("places.title")}</h2>
            </div>
            <ButtonLink href="/explorar" variant="secondary">
              {t("places.all")}
            </ButtonLink>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {places.slice(0, 6).map((place) => (
              <li key={place.id} className="flex">
                <PlaceCard place={place} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

async function TerritoryMap({ label }: { label: string }) {
  const territory = await landingTerritory();
  return <Territory territory={territory} label={label} />;
}
