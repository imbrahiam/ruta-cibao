"use client";

import type { ApiOutputs, ModerationQueueName } from "@ruta/contracts";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Clock, ImageOff } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { ModelIcon } from "@/components/category/category-model";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { orpc } from "@/lib/web/api";
import { ErrorPanel } from "./error-panel";
import { ADMIN_SECTIONS, type AdminSection as NavSection } from "./nav";
import { AdminPageHeader } from "./page-frame";
import { PersonAvatar } from "./queue/person-avatar";
import { useStaff } from "./staff-context";
import { useAdminPrefetch } from "./use-admin-prefetch";

type CountedSection = NavSection & {
  countKey: NonNullable<NavSection["countKey"]>;
};
type Queue = ApiOutputs["moderation"]["queue"];

/** Traffic counts notices live on the map, not work waiting for a decision. */
const LIVE = "traffic";
/** How many of the chosen section's items the card shows. */
const PEEK = 8;

/**
 * Where to start: one figure per section, always in the menu's order so each
 * keeps its place, and under them the next items of the section that is
 * picked. It opens on the first section with something waiting.
 */
export function AdminOverview() {
  const t = useTranslations("admin");
  const staff = useStaff();
  const counts = useQuery(orpc.moderation.counts.queryOptions());
  const data = counts.data;
  const [picked, setPicked] = useState<string | null>(null);

  const sections = ADMIN_SECTIONS.filter(
    (section): section is CountedSection =>
      section.countKey !== undefined &&
      (!section.adminOnly || staff.staffRole === "admin"),
  );
  const chosen =
    sections.find((section) => section.countKey === picked) ??
    sections.find((section) => (data?.[section.countKey] ?? 0) > 0) ??
    sections[0];

  return (
    <>
      <AdminPageHeader title={t("shell.overview")} />
      {counts.isError && !data ? (
        <ErrorPanel error={counts.error} onRetry={() => counts.refetch()} />
      ) : (
        <div aria-busy={counts.isFetching} className="flex flex-col gap-4">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]">
            {sections.map((section) => (
              <li key={section.href} className="min-w-0">
                <Figure
                  section={section}
                  count={data?.[section.countKey]}
                  selected={section === chosen}
                  onSelect={() => setPicked(section.countKey)}
                />
              </li>
            ))}
          </ul>
          {chosen && data ? (
            <Waiting
              key={chosen.countKey}
              section={chosen}
              count={data[chosen.countKey]}
            />
          ) : (
            <Skeleton className="h-80 rounded-(--radius-card)" />
          )}
        </div>
      )}
    </>
  );
}

/** One section's figure: its name, how much waits, and what that number is. */
function Figure({
  section,
  count,
  selected,
  onSelect,
}: {
  section: CountedSection;
  count: number | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const o = useTranslations("admin.overview");
  const Icon = section.icon;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-0.5 rounded-(--radius-card) border bg-card px-4 py-3.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
        selected
          ? "border-foreground/70 shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_70%,transparent)]"
          : "hover:bg-accent/60",
      )}
    >
      <span className="flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
        <span className="truncate">{o(`figure.${section.countKey}`)}</span>
        <Icon aria-hidden className="size-4 shrink-0" />
      </span>
      {count === undefined ? (
        <Skeleton className="my-1.5 h-7 w-10" />
      ) : (
        <span
          className={cn(
            "text-[28px] leading-9 font-semibold tracking-tight tabular-nums",
            count === 0 && "text-muted-foreground/70",
          )}
        >
          {count}
        </span>
      )}
      <span className="truncate text-[13px] text-muted-foreground">
        {count === 0
          ? o("upToDate")
          : o(section.countKey === LIVE ? "captionLive" : "captionWaiting")}
      </span>
    </button>
  );
}

/** The picked section: what it is, its next items, and the way into it. */
function Waiting({
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
  const peek = useQuery({
    ...orpc.moderation.queue.queryOptions({ input: { queue, limit: PEEK } }),
    enabled: count > 0,
  });
  const items = (peek.data?.[queue] ?? []) as AnyItem[];
  const figure =
    queue === LIVE
      ? o("activeNotices", { count })
      : o(`work.${queue as Exclude<ModerationQueueName, typeof LIVE>}`, {
          count,
        });

  return (
    <article
      aria-labelledby={`card-${queue}`}
      className="flex min-w-0 flex-col rounded-(--radius-card) border bg-card"
    >
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        {section.model ? <ModelIcon name={section.model} size={32} /> : null}
        <h2
          id={`card-${queue}`}
          className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-tight"
        >
          {t(section.label)}
        </h2>
        {count > 0 ? (
          <p className="hidden text-sm text-muted-foreground tabular-nums sm:block">
            {figure}
          </p>
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <Link
            href={section.href}
            onPointerEnter={() => prefetch(section.href)}
            onFocus={() => prefetch(section.href)}
          >
            {o(count > 0 ? "viewAll" : "open")}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </header>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 pt-8 pb-12 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check aria-hidden className="size-4" strokeWidth={3} />
          </span>
          <p className="font-semibold">{o("upToDate")}</p>
          <p className="text-sm text-muted-foreground">{o("upToDateBody")}</p>
        </div>
      ) : (
        <ul className="grid gap-x-6 px-3 pb-3 lg:grid-cols-2">
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
      )}
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
          <span className="truncate text-[15px] font-semibold">{title}</span>
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
