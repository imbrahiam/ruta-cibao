import { ArrowRight, CircleCheck, TriangleAlert } from "lucide-react";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TRAFFIC_COLORS } from "@/lib/map/traffic-colors";
import { cn } from "@/lib/utils";
import {
  type LandingPulse,
  type LandingTerritory,
  landingPulse,
  landingTerritory,
} from "@/modules/landing/overview";

/** Room around the drawing for the names, in viewBox units. */
const PAD_X = 12;
const PAD_Y = 76;

/**
 * The province, drawn flat from its real borders.
 *
 * Not a map — no tiles, no library, nothing to pan. Three shapes, the dam and
 * whatever is reported on the roads right now, so the page shows the territory
 * the product is about before anyone opens the real map. The whole drawing is
 * a link to that map.
 *
 * Names sit in the margins on leader lines rather than inside the shapes:
 * "Villa Los Almácigos" does not fit inside its own municipality at phone
 * width, and HTML text keeps 16 px however small the drawing gets.
 */
export async function Territory() {
  await connection();
  const [territory, pulse, t] = await Promise.all([
    landingTerritory(),
    landingPulse(),
    getTranslations("landing.territory"),
  ]);

  return (
    <TerritoryFrame
      eyebrow={t("eyebrow")}
      title={t("title")}
      drawing={
        territory.municipalities.length > 0 ? (
          <Link
            href="/mapa"
            aria-label={t("mapLabel")}
            className="landing-press block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <Drawing territory={territory} pulse={pulse} />
          </Link>
        ) : null
      }
      card={<LiveCard pulse={pulse} />}
      action={t("action")}
    />
  );
}

function TerritoryFrame({
  eyebrow,
  title,
  drawing,
  card,
  action,
}: {
  eyebrow: string;
  title: string;
  drawing: React.ReactNode;
  card: React.ReactNode;
  action: string;
}) {
  return (
    <section
      aria-labelledby="territory-title"
      className="mx-auto mt-12 max-w-6xl px-6 md:mt-24"
    >
      <div className="grid gap-6 rounded-[1.75rem] bg-secondary px-4 py-7 sm:px-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:grid-rows-[auto_1fr] md:gap-x-12 md:gap-y-8 md:rounded-[2rem] md:p-12">
        <div className="px-1 md:px-0">
          <p className="page-eyebrow mb-3">{eyebrow}</p>
          <h2 id="territory-title" className="section-title">
            {title}
          </h2>
        </div>
        <div className="mx-auto w-full max-w-[21rem] md:col-start-2 md:row-span-2 md:row-start-1 md:max-w-[28rem] md:self-center">
          {drawing}
        </div>
        <div className="flex flex-col gap-4 md:self-end">
          {card}
          <Link
            href="/mapa"
            className="landing-press inline-flex h-12 w-fit items-center gap-2 rounded-full bg-primary px-6 font-semibold text-base text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {action}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Where each name goes: above or below the drawing, and which way it reads. */
type Placement = { row: "top" | "bottom"; align: "start" | "center" | "end" };

function placeLabel(x: number, width: number, row: Placement["row"]) {
  const share = x / width;
  const align: Placement["align"] =
    share < 0.25 ? "start" : share > 0.75 ? "end" : "center";
  return { row, align };
}

function Drawing({
  territory,
  pulse,
}: {
  territory: LandingTerritory;
  pulse: LandingPulse;
}) {
  const { width, height } = territory;
  const viewWidth = width + PAD_X * 2;
  const viewHeight = height + PAD_Y * 2;

  // West to east, alternating below and above, so neighbouring names never
  // share a row. The dam always goes on top, beside its municipality's name
  // below.
  const ordered = territory.municipalities.toSorted(
    (a, b) => a.label.x - b.label.x,
  );
  const labels = [
    ...ordered.map((municipality, index) => ({
      key: municipality.id,
      text: municipality.name,
      x: municipality.label.x,
      y: municipality.label.y,
      dam: false,
      ...placeLabel(
        municipality.label.x,
        width,
        index % 2 === 0 ? "bottom" : "top",
      ),
    })),
    ...(territory.dam
      ? [
          {
            key: territory.dam.slug,
            text: territory.dam.name,
            x: territory.dam.x,
            y: territory.dam.y,
            dam: true,
            ...placeLabel(territory.dam.x, width, "top"),
          },
        ]
      : []),
  ];

  const toLeft = (x: number) => ((x + PAD_X) / viewWidth) * 100;
  const rowY = (row: Placement["row"]) =>
    row === "top" ? -PAD_Y + 50 : height + PAD_Y - 50;

  return (
    <div className="relative">
      <svg
        viewBox={`${-PAD_X} ${-PAD_Y} ${viewWidth} ${viewHeight}`}
        className="block h-auto w-full overflow-visible"
        aria-hidden
      >
        <g className="fill-card stroke-primary/70" strokeLinejoin="round">
          {territory.municipalities.map((municipality) => (
            <path
              key={municipality.id}
              d={municipality.path}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g className="stroke-foreground/45" strokeWidth={1}>
          {labels.map((label) => (
            <line
              key={label.key}
              x1={label.x}
              y1={label.y}
              x2={label.x}
              y2={rowY(label.row)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        {labels
          .filter((label) => !label.dam)
          .map((label) => (
            <circle
              key={label.key}
              cx={label.x}
              cy={label.y}
              r={3}
              className="fill-foreground"
            />
          ))}
        {territory.dam && (
          <circle
            cx={territory.dam.x}
            cy={territory.dam.y}
            r={6.5}
            fill="#5b87ad"
            stroke="white"
            strokeWidth={2}
          />
        )}
        {pulse.open.map((report) => (
          <circle
            key={report.id}
            cx={report.x}
            cy={report.y}
            r={5.5}
            fill={
              report.blocking ? TRAFFIC_COLORS.blocking : TRAFFIC_COLORS.partial
            }
            stroke="white"
            strokeWidth={2}
          />
        ))}
      </svg>
      {labels.map((label) => (
        <span
          key={label.key}
          aria-hidden
          className={cn(
            "absolute font-semibold text-[15px] leading-tight md:whitespace-nowrap md:text-base",
            // At the edges a long name folds onto two lines on a phone rather
            // than running into its neighbour.
            label.align === "center"
              ? "whitespace-nowrap"
              : "w-max max-w-[7.5rem] md:max-w-none",
            label.align === "end" && "text-right",
            label.row === "top" ? "pb-1.5" : "pt-1.5",
            label.dam && "text-[#3f6a8f]",
          )}
          style={{
            left: `${toLeft(label.x)}%`,
            top: `${((rowY(label.row) + PAD_Y) / viewHeight) * 100}%`,
            // Centred over its line, or hung from it at either edge so a long
            // name never runs off the drawing.
            transform: `translate(${
              label.align === "center"
                ? "-50%"
                : label.align === "end"
                  ? "calc(-100% + 0.75rem)"
                  : "-0.75rem"
            }, ${label.row === "top" ? "-100%" : "0"})`,
          }}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}

async function LiveCard({ pulse }: { pulse: LandingPulse }) {
  const [t, format] = await Promise.all([
    getTranslations("landing.territory"),
    getFormatter(),
  ]);
  const rows = [
    {
      key: "open",
      label: t("open"),
      value: pulse.open.length,
      icon: TriangleAlert,
      tone: "text-[#c2410c]",
    },
    {
      key: "resolved",
      label: t("resolvedWeek"),
      value: pulse.resolvedThisWeek,
      icon: CircleCheck,
      tone: "text-[#15803d]",
    },
  ] as const;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="mb-3 font-semibold text-base">{t("reports")}</h3>
      <dl className="ruled">
        {rows.map(({ key, label, value, icon: Icon, tone }) => (
          <div key={key} className="flex items-center gap-3 py-2.5">
            <Icon className={cn("size-5 shrink-0", tone)} aria-hidden />
            <dt className="flex-1 text-base">{label}</dt>
            <dd className="font-semibold text-xl tabular-nums">
              {format.number(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export async function TerritorySkeleton() {
  const t = await getTranslations("landing.territory");
  return (
    <TerritoryFrame
      eyebrow={t("eyebrow")}
      title={t("title")}
      drawing={<div className="aspect-square w-full rounded-2xl bg-card/60" />}
      card={
        <div className="h-[9.5rem] rounded-2xl border border-border bg-card" />
      }
      action={t("action")}
    />
  );
}
