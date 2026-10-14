import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * The six things the platform does, in the order a newcomer meets them.
 *
 * Numbered ruled rows rather than a grid of cards: one column reads top to
 * bottom with no puzzle about which box comes next, and every row is a single
 * link to the screen that does the job.
 */
const FEATURES = [
  { key: "places", href: "/explorar" },
  { key: "traffic", href: "/mapa?reportar=transito" },
  { key: "business", href: "/mapa?agregar=true" },
  { key: "consultations", href: "/consultas" },
  { key: "moderation", href: "/moderacion" },
  { key: "reports", href: "/informes" },
] as const;

export async function FeatureRows() {
  const t = await getTranslations("landing.features");

  return (
    <section
      aria-labelledby="features-title"
      className="mx-auto mt-12 max-w-6xl px-6 md:mt-24"
    >
      <h2 id="features-title" className="section-title mb-4 md:mb-8">
        {t("title")}
      </h2>
      <ol className="ruled border-border border-y">
        {FEATURES.map(({ key, href }, index) => (
          <li key={key}>
            <Link
              href={href}
              className="group landing-row grid min-h-20 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 md:min-h-24 md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-x-6"
            >
              <span className="meta-mono self-start pt-1 text-sm md:self-center md:pt-0">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-[17px] leading-snug md:text-2xl md:tracking-[-0.02em]">
                  {t(`${key}.title`)}
                </span>
                <span className="mt-1 block text-base text-muted-foreground leading-snug md:hidden">
                  {t(`${key}.body`)}
                </span>
              </span>
              <span className="hidden text-base text-muted-foreground leading-snug md:block md:text-lg">
                {t(`${key}.body`)}
              </span>
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ArrowRight className="landing-nudge size-5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
