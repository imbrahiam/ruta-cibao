"use client";

import type { ApiOutputs } from "@ruta/contracts";
import { useFormatter, useNow, useTranslations } from "use-intl";
import { CategoryPin } from "@/components/admin/category-pin";
import { InboxRow } from "@/components/admin/page-frame";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CaseStatusTag, PublicationTag } from "./case-tags";

type Case = ApiOutputs["consultations"]["browse"]["items"][number];

/** Two letters for an avatar with no picture: "Altagracia Peña" → "AP". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * One citizen case in the desk's inbox, read at a glance:
 * - its first photo (or its topic's glyph) on the left;
 * - the title, the topic and town, then who opened it and how long ago;
 * - its state and how much it has moved (support, replies) on the right.
 */
export function CaseInboxRow({
  item,
  href,
  reference,
  onPrefetch,
  showStatus = true,
}: {
  item: Case;
  href: string;
  /** A short id shown when another case has the same title. */
  reference?: string;
  onPrefetch?: () => void;
  /** False when the list is already filtered to one status. */
  showStatus?: boolean;
}) {
  const c = useTranslations("admin.cases");
  const q = useTranslations("admin.queue");
  const consultations = useTranslations("consultations");
  const format = useFormatter();
  // "hace 11 horas" stays true while the desk is open.
  const now = useNow({ updateInterval: 60_000 });
  const photo = item.photos?.[0];
  const morePhotos = (item.photos?.length ?? 0) - 1;
  const author = item.openedBy ?? c("anonymous");
  const created = new Date(item.createdAt);

  return (
    <InboxRow
      href={href}
      title={item.title}
      onPrefetch={onPrefetch}
      lead={
        photo ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            {/* biome-ignore lint/performance/noImgElement: signed storage URLs and demo files, not optimisable */}
            <img
              src={photo.url}
              alt=""
              width={photo.width}
              height={photo.height}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
            {morePhotos > 0 ? (
              <span className="absolute right-1 bottom-1 rounded-full bg-black/60 px-1.5 text-[11px] leading-4 font-medium text-white tabular-nums">
                +{morePhotos}
              </span>
            ) : null}
          </span>
        ) : (
          <CategoryPin
            icon={item.categoryIcon}
            color={item.categoryColor}
            tile
          />
        )
      }
      badge={
        <>
          {reference ? (
            <span className="text-[13px] text-muted-foreground tabular-nums">
              #{reference}
            </span>
          ) : null}
          {item.publicationStatus === "published" ? null : (
            <PublicationTag status={item.publicationStatus} />
          )}
        </>
      }
      meta={
        <>
          {item.categoryName}
          {item.municipalityName}
        </>
      }
      byline={
        <>
          <Avatar aria-hidden className="size-5">
            {item.openedByImage ? (
              <AvatarImage
                src={item.openedByImage}
                alt=""
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="bg-muted text-[9px] font-medium text-muted-foreground">
              {initials(author)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-foreground/80">{author}</span>
          <time
            dateTime={item.createdAt}
            title={format.dateTime(created, "long")}
            className="shrink-0 tabular-nums"
          >
            {format.relativeTime(created, now)}
          </time>
        </>
      }
      summary={
        // Figures in words, beside the title rather than at the far edge.
        <div className="flex flex-col items-end gap-1.5">
          {showStatus ? <CaseStatusTag status={item.status} /> : null}
          <p className="flex items-center gap-3 text-[13px] whitespace-nowrap">
            <span>{q("supportCount", { count: item.supportCount })}</span>
            {/* Replies only once there are some; a row of zeros is noise. */}
            {item.responseCount > 0 ? (
              <span>
                {consultations("responses", { count: item.responseCount })}
              </span>
            ) : null}
          </p>
        </div>
      }
    />
  );
}
