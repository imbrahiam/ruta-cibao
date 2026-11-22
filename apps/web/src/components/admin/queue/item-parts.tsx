"use client";

import { LocateFixed, MapPin, ShieldCheck, UserRound } from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFormatter, useTranslations } from "use-intl";
import { MetaList, PropertyList, PropertyRow } from "@/components/admin/facts";
import { useDay } from "@/components/admin/use-day";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { itemDomId, useItemFrame } from "../map/item-frame";
import { MediaViewer } from "../media-viewer";

/**
 * A short fact as a pill: a state in its colour, or a plain one (the town, a
 * length) on the muted surface. Facts read as chips, not as a sentence of
 * words strung together with dots.
 */
export function Chip({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0",
        className ?? "bg-muted text-foreground/80",
      )}
    >
      {children}
    </span>
  );
}

/** Rows pass their facts in a fragment; `MetaList` needs them one by one. */
function facts(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? facts(child.props.children)
      : [child],
  );
}

/**
 * One item, in the order it is reviewed: what it is and who sent it, the
 * evidence, then the decision at the end under a hairline. At every width, so
 * no one reaches "Publicar" before reading what they publish.
 */
export function ItemRow({
  titleId,
  itemId,
  title,
  lead,
  badge,
  meta,
  summary,
  byline,
  aside,
  media,
  detail,
  decision,
}: {
  titleId: string;
  /**
   * The item's id, for rows that sit beside a map: ties the row to its marker
   * (see `map/item-frame`). Rows without a map beside them may omit it.
   */
  itemId?: string;
  title: ReactNode;
  /** A picture beside the title block: the place, or the person. */
  lead?: ReactNode;
  /** A state worth naming, in a pill beside the title. */
  badge?: ReactNode;
  /** Inline facts under the title: municipality, kind, verified marker. */
  meta?: ReactNode;
  /**
   * The sender's own words, read together with the title and `meta`: what was
   * reported, before who reported it.
   */
  summary?: ReactNode;
  /** Who sent it and when; quieter than `meta`. */
  byline?: ReactNode;
  /** A way out to the subject itself (its public page), top right. */
  aside?: ReactNode;
  /**
   * The item's map. In a wide row it stands beside `detail`, with the
   * decision under the facts at the map's foot, so the card is as tall as
   * the map and no taller.
   */
  media?: ReactNode;
  detail?: ReactNode;
  decision: ReactNode;
}) {
  const t = useTranslations("admin.queue.map");
  const frame = useItemFrame();
  const linked = frame !== null && itemId !== undefined;
  const selected = linked && frame.selectedId === itemId;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the "Ver en el mapa" button is the keyboard path; the row click is a pointer shortcut
    <li
      id={itemId === undefined ? undefined : itemDomId(itemId)}
      aria-labelledby={titleId}
      aria-current={selected ? "true" : undefined}
      onClick={linked ? () => frame.onSelect(itemId) : undefined}
      className={cn(
        "grid gap-4 px-4 py-5 sm:px-5",
        selected && "bg-primary/[0.06] shadow-[inset_3px_0_0_var(--primary)]",
      )}
    >
      <div className="flex min-w-0 gap-3">
        {lead}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* The way out (`aside`) shares the title's line, so everything
              below, the decision included, runs to the card's right edge. */}
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <h2
                id={titleId}
                title={typeof title === "string" ? title : undefined}
                className="line-clamp-2 text-base leading-snug font-semibold break-words"
              >
                {title}
              </h2>
              {badge}
            </div>
            {aside ? <div className="-my-1 shrink-0">{aside}</div> : null}
          </div>
          <MetaList>{facts(meta)}</MetaList>
          {summary ? (
            <p className="text-[15px] leading-relaxed text-pretty break-words">
              {summary}
            </p>
          ) : null}
          {/* One quieter line of the same kind as the facts above, not a
              stack of differently sized sentences. With nothing else to read
              (no detail below), the map shortcut and the decision share it,
              on the right, so the card stays short; they wrap under it when
              the column is narrow or a reason is being written. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1 basis-48">
              <MetaList className="text-[13px]">{facts(byline)}</MetaList>
            </div>
            {linked ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("showOnMap")}
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      frame.onSelect(itemId);
                    }}
                    className="size-8 shrink-0 text-primary pointer-coarse:size-11"
                  >
                    <LocateFixed aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("showOnMap")}</TooltipContent>
              </Tooltip>
            ) : null}
            {detail || media ? null : (
              <div className="ml-auto min-w-0 max-w-full">{decision}</div>
            )}
          </div>
        </div>
      </div>
      {media ? (
        // By the row's own width, not the window's: beside the queue map the
        // row is a narrow column.
        <div className="@container/item min-w-0">
          <div className="grid gap-x-6 gap-y-4 @2xl/item:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            {media}
            <div className="flex min-w-0 flex-col gap-4">
              {detail}
              <div className="mt-auto min-w-0">{decision}</div>
            </div>
          </div>
        </div>
      ) : detail ? (
        <>
          <div className="@container/item flex min-w-0 flex-col gap-3">
            {detail}
          </div>
          {/* After the evidence, in reading and tab order: read, then decide. */}
          <div className="min-w-0 pt-1">{decision}</div>
        </>
      ) : null}
    </li>
  );
}

/** Which municipality an item belongs to: always on show, as text. */
export function MunicipalityTag({ name }: { name: string }) {
  const t = useTranslations("admin");
  return (
    <span className="inline-flex items-center gap-1">
      <MapPin aria-hidden className="size-3.5" />
      <span className="sr-only">{t("municipality")}: </span>
      {name}
    </span>
  );
}

/** The quiet marker for a verified resident; render it only when verified. */
export function ResidentBadge() {
  const t = useTranslations("admin.queue");
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-foreground">
      <ShieldCheck aria-hidden className="size-3.5" />
      {t("residentBadge")}
    </span>
  );
}

/** Labelled values of an item, two to a row when there is room. */
export function Facts({ children }: { children: ReactNode }) {
  return (
    // Kept to a reading width: two facts half a screen apart read as unrelated.
    <PropertyList className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-2">
      {children}
    </PropertyList>
  );
}

/** One labelled value; `wide` for free text that needs the full row. */
export function Fact({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <PropertyRow
      label={label}
      className={cn(
        // The evidence is what the reviewer reads: body size, not caption.
        "min-w-0 [overflow-wrap:anywhere] whitespace-pre-line [&>dd]:text-[15px]",
        wide && "sm:col-span-2",
      )}
    >
      {children}
    </PropertyRow>
  );
}

/**
 * Free text that stays three lines until someone asks for the rest. The
 * toggle only exists when the text actually overflows, so short evidence
 * costs no extra control.
 */
export function ClampedText({ children }: { children: string }) {
  const t = useTranslations("admin.queue");
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the text changes
  useEffect(() => {
    const element = ref.current;
    if (!element || expanded) return;
    const measure = () =>
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded, children]);

  return (
    <>
      <p ref={ref} id={id} className={cn(!expanded && "line-clamp-3")}>
        {children}
      </p>
      {overflowing || expanded ? (
        <Button
          variant="link"
          className="mt-1 h-auto p-0 text-xs has-[>svg]:px-0 pointer-coarse:min-h-11"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("showLess") : t("showMore")}
        </Button>
      ) : null}
    </>
  );
}

/** "Recibido el 3 oct a las 4:05 p. m." from an ISO instant. */
export function useWhen() {
  const format = useFormatter();
  const day = useDay();
  const t = useTranslations("admin.queue");
  return (key: "receivedAt" | "expiresAt", iso: string) => {
    const date = new Date(iso);
    return t(key, {
      date: day(date),
      time: format.dateTime(date, "time"),
    });
  };
}

/** A person's name as the API gave it, or the anonymous wording. */
export function usePerson() {
  const t = useTranslations("admin.queue");
  return (
    named:
      | "submittedBy"
      | "reportedBy"
      | "uploadedBy"
      | "claimedBy"
      | "openedBy",
    name: string | null,
  ) => (name ? t(named, { name }) : t(`${named}Anon`));
}

/**
 * The picture that anchors a row: the place's photo when it has one, else
 * the person's own, else nothing. The place's photo is evidence and opens in
 * the desk's viewer like every other picture; a person's avatar is only an
 * identity mark beside their name.
 */
export function LeadImage({
  placeImage,
  personImage,
  placeName,
  large,
}: {
  placeImage?: string | null;
  personImage?: string | null;
  /** Names the place photo for the viewer and screen readers. */
  placeName: string;
  /** Fills its box (beside a map) instead of a small square before a title. */
  large?: boolean;
}) {
  const q = useTranslations("admin.queue");
  const [viewing, setViewing] = useState<number | null>(null);
  const source = placeImage ?? personImage ?? null;
  // A stand-in glyph beside a business name said "person" and pushed the
  // title off the left edge the evidence below starts on; no picture, no tile.
  if (!source) return null;

  if (placeImage) {
    const alt = q("photoAlt", { place: placeName });
    return (
      <>
        <button
          type="button"
          onClick={() => setViewing(0)}
          aria-label={q("photoOpen", { place: placeName })}
          className={cn(
            "shrink-0 cursor-zoom-in overflow-hidden rounded-(--radius-field) border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            large ? "block aspect-[4/3] w-full" : "size-12",
          )}
        >
          {/* biome-ignore lint/performance/noImgElement: arbitrary uploaded host, reviewed as-is */}
          <img
            src={placeImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        </button>
        <MediaViewer
          items={[{ kind: "image", src: placeImage, alt }]}
          index={viewing}
          onIndexChange={setViewing}
        />
      </>
    );
  }

  return (
    <Avatar aria-hidden="true" className="size-12 shrink-0 rounded-full">
      <AvatarImage src={source} alt="" className="object-cover" />
      <AvatarFallback className="rounded-full bg-muted text-muted-foreground">
        <UserRound className="size-5" />
      </AvatarFallback>
    </Avatar>
  );
}
