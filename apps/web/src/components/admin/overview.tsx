"use client";

import type { ApiOutputs, ModerationQueueName } from "@ruta/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Clock, ImageOff } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { ModelIcon } from "@/components/category/category-model";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/web/api";
import { ErrorPanel } from "./error-panel";
import { ADMIN_SECTIONS, type AdminSection as NavSection } from "./nav";
import { AdminPageHeader, AdminSection } from "./page-frame";
import { PersonAvatar } from "./queue/person-avatar";
import { useStaff } from "./staff-context";
import { useAdminPrefetch } from "./use-admin-prefetch";

type CountedSection = NavSection & {
  countKey: NonNullable<NavSection["countKey"]>;
};
type Queue = ApiOutputs["moderation"]["queue"];

/**
 * Traffic counts notices live on the map, not work waiting for a decision:
 * it is said apart and left out of the "Pendiente" total.
 */
const LIVE = "traffic";
/** How many of a section's items its card shows. */
const PEEK = 3;

/**
 * Where to start: a card for each section with work waiting, heaviest first,
 * showing the next few items so the desk reads what is there before opening
 * it; what is live on the map now; and the sections that are up to date.
 */
export function AdminOverview() {
  const t = useTranslations("admin");
  const o = useTranslations("admin.overview");
  const staff = useStaff();
  const counts = useQuery(orpc.moderation.counts.queryOptions());
  const data = counts.data;

  const sections = ADMIN_SECTIONS.filter(
    (section): section is CountedSection =>
      section.countKey !== undefined &&
      (!section.adminOnly || staff.staffRole === "admin"),
  );
  const work = sections.filter((section) => section.countKey !== LIVE);
  const live = sections.find((section) => section.countKey === LIVE);
  const waiting = data
    ? work
        .filter((section) => data[section.countKey] > 0)
        .sort((a, b) => data[b.countKey] - data[a.countKey])
    : [];
  const clear = data
    ? work.filter((section) => data[section.countKey] === 0)
    : [];
  const total = waiting.reduce(
    (sum, section) => sum + (data?.[section.countKey] ?? 0),
    0,
  );
  const activeNotices = data?.[LIVE] ?? 0;

  return (
    <>
      <AdminPageHeader title={t("shell.overview")} />
      {counts.isError && !data ? (
        <ErrorPanel error={counts.error} onRetry={() => counts.refetch()} />
      ) : !data ? (
        <div
          role="status"
          aria-busy="true"
          className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3"
        >
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
            <CardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div aria-busy={counts.isFetching} className="flex flex-col gap-8">
          {waiting.length > 0 ? (
            <AdminSection
              id="overview-waiting"
              title={t("pending")}
              count={total}
            >
              <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {waiting.map((section) => (
                  <WorkCard
                    key={section.href}
                    section={section}
                    count={data[section.countKey]}
                  />
                ))}
              </div>
            </AdminSection>
          ) : null}
          {live && activeNotices > 0 ? (
            <AdminSection id="overview-live" title={o("live")}>
              <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                <WorkCard section={live} count={activeNotices} />
                {clear.length > 0 ? <UpToDate sections={clear} /> : null}
              </div>
            </AdminSection>
          ) : clear.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <UpToDate sections={clear} />
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

/** One section with work waiting: what it is, how much, and the next items. */
function WorkCard({
  section,
  count,
}: {
  section: CountedSection;
  count: number;
}) {
  const t = useTranslations("admin");
  const o = useTranslations("admin.overview");
  const prefetch = useAdminPrefetch(useStaff());
  const queue = section.countKey as ModerationQueueName;
  const peek = useQuery(
    orpc.moderation.queue.queryOptions({
      input: { queue, limit: PEEK },
    }),
  );
  const items = (peek.data?.[queue] ?? []) as AnyItem[];
  const figure =
    queue === LIVE
      ? o("activeNotices", { count })
      : o(`work.${queue as Exclude<ModerationQueueName, typeof LIVE>}`, {
          count,
        });
  const rest = count - items.length;

  return (
    <article
      aria-labelledby={`card-${queue}`}
      className="flex min-w-0 flex-col rounded-(--radius-card) border bg-card shadow-(--shadow-control)"
    >
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        {section.model ? <ModelIcon name={section.model} size={32} /> : null}
        <div className="flex min-w-0 flex-col">
          <h3 id={`card-${queue}`} className="truncate text-[15px] font-medium">
            {t(section.label)}
          </h3>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {figure}
          </p>
        </div>
      </header>

      <ul className="flex flex-col px-2">
        {peek.isPending
          ? Array.from({ length: Math.min(count, PEEK) }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
              <li key={index} className="flex items-center gap-3 px-2 py-2.5">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <span className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </span>
              </li>
            ))
          : items.map((item) => (
              <PeekRow
                key={item.id}
                href={section.href}
                queue={queue}
                item={item}
                onPrefetch={() => prefetch(section.href)}
              />
            ))}
      </ul>

      <footer className="mt-2 border-t px-4 py-2.5">
        <Link
          href={section.href}
          onPointerEnter={() => prefetch(section.href)}
          onFocus={() => prefetch(section.href)}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground"
        >
          {rest > 0 && !peek.isPending ? (
            <>
              {o("viewAll")}
              <Badge
                variant="secondary"
                className="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
              >
                {count}
              </Badge>
            </>
          ) : (
            o("viewAllIn", { section: t(section.label) })
          )}
          <ArrowRight
            aria-hidden
            className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </Link>
      </footer>
    </article>
  );
}

type AnyItem = Queue[ModerationQueueName][number];

/**
 * One waiting item, as briefly as it can be told: what (a name or a title),
 * where or who, and how long ago, with the picture that identifies it.
 */
function PeekRow({
  href,
  queue,
  item,
  onPrefetch,
}: {
  href: string;
  queue: ModerationQueueName;
  item: AnyItem;
  onPrefetch: () => void;
}) {
  const q = useTranslations("admin.queue");
  const o = useTranslations("admin.overview");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const ago = (iso: string) => format.relativeTime(new Date(iso), now);
  // Only the card's header carries the section's model; each row shows the
  // person behind the item (or its photo), so the models are not repeated.
  const who = (
    name: string | null,
    image: string | null = null,
    verified = false,
  ) => (
    <PersonAvatar
      name={name}
      image={image}
      className="size-9"
      verified={verified ? q("residentBadge") : undefined}
    />
  );

  let lead: ReactNode = null;
  let title = "";
  let meta: ReactNode = null;
  let end: ReactNode = null;

  switch (queue) {
    case "consultations": {
      const c = item as Queue["consultations"][number];
      const photo = c.photos?.[0]?.url;
      // Its photo when it has one (the evidence); else who opened it.
      lead = photo ? <Thumb src={photo} /> : who(c.openedBy);
      title = c.title;
      meta = `${c.categoryName} · ${c.municipalityName}`;
      end = ago(c.createdAt);
      break;
    }
    case "claims": {
      const c = item as Queue["claims"][number];
      lead = (
        <PersonAvatar
          name={c.claimedBy}
          image={c.claimedByImage}
          className="size-9"
          verified={c.claimantResidentVerified ? q("residentBadge") : undefined}
        />
      );
      title = c.placeName;
      meta = `${c.claimedBy ?? o("anonymous")} · ${c.municipalityName}`;
      end = ago(c.createdAt);
      break;
    }
    case "reports": {
      const r = item as Queue["reports"][number];
      lead = who(r.reportedBy, r.reportedByImage, r.reporterResidentVerified);
      title = r.placeName;
      meta = r.details ?? q(`reportReason.${r.reason}`);
      end = ago(r.createdAt);
      break;
    }
    case "places": {
      const p = item as Queue["places"][number];
      lead = who(p.submittedBy, null, p.submitterResidentVerified);
      title = p.name;
      meta = `${p.categoryName} · ${p.municipalityName}`;
      end = ago(p.createdAt);
      break;
    }
    case "photos": {
      const p = item as Queue["photos"][number];
      lead = <Thumb src={p.url} />;
      title = p.placeName;
      meta = `${p.uploadedBy ?? o("anonymous")} · ${p.municipalityName}`;
      end = ago(p.createdAt);
      break;
    }
    case "contentReports": {
      const r = item as Queue["contentReports"][number];
      lead = who(r.reportedBy);
      title = r.subjectTitle ?? r.municipalityName;
      meta = r.details ?? r.municipalityName;
      end = ago(r.createdAt);
      break;
    }
    case "traffic": {
      const r = item as Queue["traffic"][number];
      lead = who(r.reportedBy, r.reportedByImage, r.reporterResidentVerified);
      title = r.categoryName;
      meta = r.description ?? r.municipalityName;
      end = (
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden className="size-3" />
          {format.dateTime(new Date(r.expiresAt), "time")}
        </span>
      );
      break;
    }
  }

  return (
    <li>
      <Link
        href={href}
        onPointerEnter={onPrefetch}
        onFocus={onPrefetch}
        className="flex items-center gap-3 rounded-lg px-2 py-2 outline-none hover:bg-accent/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className="flex size-9 shrink-0 items-center justify-center">
          {lead}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate text-[13px] text-muted-foreground">
            {meta}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {end}
        </span>
      </Link>
    </li>
  );
}

function Thumb({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ImageOff aria-hidden className="size-4" />
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: signed, already-sized storage URLs
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setBroken(true)}
      className="size-9 rounded-lg bg-muted object-cover"
    />
  );
}

/** The sections with nothing waiting, each still a way in. */
function UpToDate({ sections }: { sections: CountedSection[] }) {
  const t = useTranslations("admin");
  const o = useTranslations("admin.overview");
  const prefetch = useAdminPrefetch(useStaff());
  return (
    <article
      aria-labelledby="card-up-to-date"
      className="flex flex-col gap-3 rounded-(--radius-card) border border-dashed p-4"
    >
      <header className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check aria-hidden className="size-4" strokeWidth={3} />
        </span>
        <div className="flex flex-col">
          <h3 id="card-up-to-date" className="text-[15px] font-medium">
            {o("upToDate")}
          </h3>
          <p className="text-[13px] text-muted-foreground">
            {o("upToDateBody")}
          </p>
        </div>
      </header>
      <ul className="flex flex-wrap gap-2">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              onPointerEnter={() => prefetch(section.href)}
              onFocus={() => prefetch(section.href)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border bg-card pr-3 pl-1.5 text-sm",
                "outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
              )}
            >
              {section.model ? (
                <ModelIcon name={section.model} size={20} />
              ) : null}
              {t(section.label)}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-(--radius-card) border p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-lg" />
        <span className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </span>
      </div>
      {Array.from({ length: PEEK }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <span className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </span>
        </div>
      ))}
    </div>
  );
}
