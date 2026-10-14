import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { landingPulse } from "@/modules/landing/overview";

/**
 * The province in three real counts.
 *
 * No counting-up animation: the number is the number the moment it paints. On
 * a phone the three are ruled rows — a label beside its figure reads in one
 * glance, where three narrow columns would wrap every label into a paragraph.
 */
export async function NumbersStrip() {
  await connection();
  const [pulse, t, format] = await Promise.all([
    landingPulse(),
    getTranslations("landing.numbers"),
    getFormatter(),
  ]);

  // A zero on the landing reads as an empty product, not as a fact about this
  // month — so a count with nothing in it steps out until it has something.
  const stats = (
    [
      { key: "places", value: pulse.places },
      { key: "routes", value: pulse.routes },
      { key: "resolved", value: pulse.resolvedThisMonth },
    ] as const
  ).filter(({ value }) => value > 0);
  if (stats.length === 0) return null;

  return (
    <NumbersFrame title={t("title")} columns={stats.length}>
      {stats.map(({ key, value }) => (
        <div
          key={key}
          className="flex flex-row-reverse items-baseline justify-end gap-4 py-4 md:flex-col-reverse md:gap-3 md:py-0 md:pl-8 md:first:pl-0"
        >
          <dt className="text-base text-muted-foreground leading-snug md:text-lg">
            {t(key, { count: value })}
          </dt>
          <dd className="stat-number min-w-[3.25rem] shrink-0">
            {format.number(value)}
          </dd>
        </div>
      ))}
    </NumbersFrame>
  );
}

function NumbersFrame({
  title,
  columns = 3,
  children,
}: {
  title: string;
  columns?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="numbers-title"
      className="mx-auto mt-12 max-w-6xl px-4 sm:px-5 md:mt-24"
    >
      <h2 id="numbers-title" className="page-eyebrow mb-3 md:mb-8">
        {title}
      </h2>
      <dl
        style={
          {
            "--numbers-columns": `repeat(${columns}, minmax(0, 1fr))`,
          } as React.CSSProperties
        }
        className="ruled flex flex-col border-border border-y md:grid md:grid-cols-(--numbers-columns) md:border-0 md:[&>*+*]:border-t-0 md:[&>*+*]:border-l"
      >
        {children}
      </dl>
    </section>
  );
}

/** Same height as the real strip, so nothing jumps when the counts arrive. */
export async function NumbersSkeleton() {
  const t = await getTranslations("landing.numbers");
  return (
    <NumbersFrame title={t("title")}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex items-center gap-4 py-4 md:flex-col md:items-start md:gap-3 md:py-0 md:pl-8 md:first:pl-0"
        >
          <dt className="h-10 w-[3.25rem] rounded-lg bg-secondary sm:h-14" />
          <dd className="h-5 w-40 rounded bg-secondary" />
        </div>
      ))}
    </NumbersFrame>
  );
}
