import { Map as MapIcon, Search, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The first screen: a question, a search, and the two things people come for.
 *
 * The photograph carries the mood (calm, the province's own landscape) and the
 * question sits on it in plain white; the search pill straddles its bottom
 * edge so it is the first control the eye lands on after the words. The two
 * tasks under it skip searching entirely — the map, or a report.
 *
 * The search goes to Explorar's search, which takes `?q=` and works without
 * JavaScript; the map's own search has no URL to arrive at.
 */
export async function Hero() {
  const t = await getTranslations("landing");

  return (
    <section aria-labelledby="hero-title" className="px-3 pt-2 sm:px-5 md:pt-4">
      <div className="mx-auto max-w-7xl">
        <div className="relative isolate flex h-[min(62svh,30rem)] min-h-[22rem] flex-col items-center justify-center overflow-hidden rounded-[1.75rem] bg-[#4f6b5b] px-6 text-center text-white md:h-[34rem] md:rounded-[2rem]">
          <Image
            src="/places/presa-moncion.webp"
            alt={t("photoAlt")}
            fill
            preload
            loading="eager"
            sizes="(min-width: 1280px) 1280px, 100vw"
            className="-z-10 object-cover object-[50%_45%] saturate-[.85]"
          />
          {/* A scrim strong enough for white text over any part of the sky or
              the trees, darkest where the words sit. */}
          <div
            aria-hidden
            className="-z-10 absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,rgb(18_28_22/.55),rgb(18_28_22/.18)_70%)]"
          />
          <p className="mb-4 font-medium text-base text-white/90 md:text-lg">
            {t("region")}
          </p>
          <h1
            id="hero-title"
            className="display-title max-w-[12ch] text-white md:max-w-none [text-shadow:0_1px_24px_rgb(0_0_0/.25)]"
          >
            {t("question")}
          </h1>
          <p className="absolute top-4 right-4 rounded-full bg-black/45 px-3 py-1.5 font-medium text-[13px] text-white md:top-5 md:right-5">
            {t("photoCaption")} · {t("illustration")}
          </p>
        </div>

        <div className="relative z-10 mx-auto -mt-7 max-w-2xl px-3 md:-mt-8">
          <search>
            <form
              action="/explorar"
              className="flex h-14 items-center gap-2 rounded-full border border-border bg-card pr-1.5 pl-5 ring-4 ring-background md:h-16 md:pr-2 md:pl-6"
            >
              <Search
                className="size-5 shrink-0 text-muted-foreground"
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
                className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-lg"
              />
              <button
                type="submit"
                className="landing-press h-11 shrink-0 rounded-full bg-primary px-5 font-semibold text-base text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 md:h-12 md:px-6"
              >
                {t("searchSubmit")}
              </button>
            </form>
          </search>

          <nav
            aria-label={t("tasks")}
            className="mt-3 grid grid-cols-2 gap-3 md:mt-5 md:flex md:justify-center"
          >
            <TaskLink href="/mapa" icon={MapIcon} primary>
              {t("openMap")}
            </TaskLink>
            <TaskLink href="/mapa?reportar=transito" icon={TriangleAlert}>
              {t("report")}
            </TaskLink>
          </nav>
        </div>
      </div>
    </section>
  );
}

/**
 * A direct task. On a phone a tile, so a two-word label never truncates; on a
 * wide screen a pill beside its pair.
 */
function TaskLink({
  href,
  icon: Icon,
  primary = false,
  children,
}: {
  href: string;
  icon: typeof MapIcon;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "landing-press flex min-h-[5.5rem] flex-col items-start justify-between gap-3 rounded-2xl p-4 font-semibold text-base leading-tight focus-visible:outline-2 focus-visible:outline-offset-2",
        "md:min-h-12 md:flex-row md:items-center md:gap-2.5 md:rounded-full md:py-0 md:pr-6 md:pl-2",
        primary
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-full md:size-9",
          primary ? "bg-white/15" : "bg-card",
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      {children}
    </Link>
  );
}
