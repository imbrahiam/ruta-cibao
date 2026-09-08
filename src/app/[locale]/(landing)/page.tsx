import {
  ArrowRight,
  Check,
  Compass,
  MapPin,
  MapPinPlus,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { FeaturedPlaces } from "@/components/discover/featured-places";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MagicCard } from "@/components/ui/magic-card";
import { Link } from "@/i18n/navigation";

export default async function Landing() {
  const t = await getTranslations("landing");
  return (
    <div className="mx-auto max-w-6xl px-5 pt-8 pb-12 sm:px-6 md:pt-14 md:pb-20">
      <header className="mb-8 flex flex-col justify-between gap-7 lg:mb-10 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground sm:text-xs">
            <MapPin className="size-3.5" aria-hidden />
            {t("region")}
          </p>
          <h1 className="max-w-2xl text-balance text-[2.6rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-5 max-w-lg text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {t("subhead")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0 lg:flex-col lg:items-stretch">
          <Button
            size="lg"
            className="h-12 flex-1 rounded-full px-6 sm:flex-none"
            nativeButton={false}
            render={<Link href="/mapa" />}
          >
            <Compass className="size-4" aria-hidden />
            {t("openMap")}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button
            variant="ghost"
            className="h-12 flex-1 rounded-full px-5 text-muted-foreground sm:flex-none"
            nativeButton={false}
            render={<a href="#como-funciona" />}
          >
            {t("howLink")}
          </Button>
        </div>
      </header>

      <div className="grid gap-5 md:grid-cols-3">
        <section className="min-w-0 md:col-span-2">
          <p className="mb-3 pl-1 text-xs font-medium text-muted-foreground">
            {t("discoverLabel")}
          </p>
          <Link
            href="/explorar"
            className="group relative flex min-h-80 overflow-hidden rounded-3xl bg-[#bed0b4] focus-visible:outline-2 focus-visible:outline-offset-4 md:min-h-96"
          >
            <Image
              src="/places/presa-moncion.webp"
              alt={t("landscapeAlt")}
              fill
              preload
              sizes="(min-width: 768px) 750px, 100vw"
              className="object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.025]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
            <span className="absolute right-5 top-5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-[#213d34]">
              {t("illustration")}
            </span>
            <div className="relative mt-auto flex w-full items-end justify-between gap-4 p-6 text-white md:p-8">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[.14em] text-white/80">
                  {t("landscapeEyebrow")}
                </p>
                <h2 className="text-3xl font-medium tracking-tight md:text-4xl">
                  {t("landscapeTitle")}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/85">
                  {t("landscapeBody")}
                </p>
              </div>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-[#213d34]">
                <ArrowRight className="size-5" aria-hidden />
              </span>
            </div>
          </Link>
        </section>

        <section className="flex min-w-0 flex-col">
          <p className="mb-3 pl-1 text-xs font-medium text-muted-foreground">
            {t("communityLabel")}
          </p>
          <Card className="flex flex-1 flex-col justify-between gap-8 rounded-3xl bg-[#213d34] p-7 text-white ring-0 md:p-8">
            <span className="flex size-11 items-center justify-center rounded-2xl border border-white/15">
              <MapPinPlus className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-balance text-3xl font-medium leading-tight tracking-tight">
                {t("communityTitle")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                {t("communityBody")}
              </p>
            </div>
            <Button
              className="h-11 w-full rounded-full bg-white text-[#213d34] hover:bg-white/90"
              nativeButton={false}
              render={<Link href="/mapa?agregar=true" />}
            >
              {t("communityAction")}
              <ArrowRight aria-hidden />
            </Button>
          </Card>
        </section>

        <Card className="surface-card gap-5 p-6 ring-0 md:p-7">
          <div className="flex items-center justify-between">
            <Compass className="size-5 text-primary" aria-hidden />
            <span className="text-xs text-muted-foreground">
              {t("noAccount")}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">
              {t("findTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("findBody")}
            </p>
          </div>
          <form
            action="/explorar"
            className="mt-auto flex h-12 items-center gap-2 rounded-xl border bg-background pl-3"
          >
            <input
              name="q"
              aria-label={t("search")}
              placeholder={t("searchPlaceholder")}
              maxLength={100}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="mr-1 size-10"
              aria-label={t("search")}
            >
              <ArrowRight aria-hidden />
            </Button>
          </form>
        </Card>

        <Card className="surface-card gap-5 p-6 ring-0 md:p-7">
          <ShieldCheck className="size-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-xl font-medium tracking-tight">
              {t("trustTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("trustBody")}
            </p>
          </div>
          <div className="mt-auto flex items-center gap-2 text-xs font-medium text-primary">
            <Check className="size-4" aria-hidden />
            {t("trustFootnote")}
          </div>
        </Card>

        <Link
          href="/instalar"
          className="group flex flex-col justify-between gap-5 rounded-3xl bg-[#e7eff4] p-6 text-[#213d34] focus-visible:outline-2 focus-visible:outline-offset-4 md:p-7"
        >
          <div className="flex items-center justify-between">
            <Smartphone className="size-5 text-[#3e5d72]" aria-hidden />
            <ArrowRight className="size-4 text-[#3e5d72]" aria-hidden />
          </div>
          <div>
            <h2 className="text-xl font-medium tracking-tight">
              {t("installTitle")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#486173]">
              {t("installBody")}
            </p>
          </div>
          <span className="text-xs font-medium text-[#3e5d72]">
            {t("installAction")}
          </span>
        </Link>
      </div>

      <section
        className="mt-14 mb-8 md:mt-20"
        aria-labelledby="featured-heading"
      >
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {t("featuredEyebrow")}
            </p>
            <h2
              id="featured-heading"
              className="text-balance text-2xl font-medium tracking-tight md:text-3xl"
            >
              {t("featuredTitle")}
            </h2>
          </div>
          <Link
            href="/explorar"
            className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-primary"
          >
            {t("seeAll")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <FeaturedPlaces />
      </section>

      <section
        id="como-funciona"
        className="mt-14 scroll-mt-24 rounded-[2rem] border border-primary/8 bg-accent/50 p-5 sm:p-7 md:mt-20 md:p-10"
        aria-labelledby="how-heading"
      >
        <div className="grid items-end gap-4 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-primary">
              <UsersRound className="size-4" aria-hidden />
              {t("howEyebrow")}
            </p>
            <h2
              id="how-heading"
              className="max-w-sm text-balance text-3xl font-semibold leading-[1.15] tracking-[-0.035em] md:text-4xl"
            >
              {t("howTitle")}
            </h2>
          </div>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
            {t("howBody")}
          </p>
        </div>
        <ol className="mt-7 grid gap-3 md:mt-9 md:grid-cols-3 md:gap-4">
          {(
            [
              { key: "find", Icon: Compass, href: "/explorar" },
              { key: "add", Icon: MapPinPlus, href: "/mapa?agregar=true" },
              { key: "verify", Icon: ShieldCheck, href: "/mapa" },
            ] as const
          ).map(({ key, Icon, href }, index) => (
            <li key={key} className="min-w-0 rounded-2xl">
              <MagicCard
                className="h-full rounded-2xl [&>div:last-child]:h-full"
                gradientOpacity={0}
                gradientFrom="#5b8b72"
                gradientTo="#c5d9cc"
              >
                <div className="flex h-full flex-col p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-x-3 md:gap-y-5">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="flex-1 text-lg font-medium tracking-tight md:order-3 md:basis-full md:text-xl">
                      {t(`features.${key}.title`)}
                    </h3>
                    <span
                      className="text-sm font-medium tabular-nums text-muted-foreground md:ml-auto"
                      aria-hidden
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mt-3 mb-2 text-pretty text-sm leading-relaxed text-muted-foreground md:mt-2 md:mb-5">
                    {t(`features.${key}.body`)}
                  </p>
                  <Link
                    href={href}
                    className="group/step -ml-2 mt-auto inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {t(`stepActions.${key}`)}
                    <ArrowRight
                      className="size-4 transition-transform motion-safe:group-hover/step:translate-x-1"
                      aria-hidden
                    />
                  </Link>
                </div>
              </MagicCard>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-start justify-center gap-2 text-xs leading-relaxed text-muted-foreground sm:items-center">
          <Check className="mt-0.5 size-3.5 shrink-0 sm:mt-0" aria-hidden />
          {t("howNote")}
        </p>
      </section>
    </div>
  );
}
