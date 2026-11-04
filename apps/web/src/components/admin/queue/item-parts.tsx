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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { itemDomId, useItemFrame } from "../map/item-frame";

/** Rows pass their facts in a fragment; `MetaList` needs them one by one. */
function facts(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment
      ? facts(child.props.children)
      : [child],
  );
}

/**
 * One item: identity, detail facts and the decision, in one row of the list's
 * shared surface. Three columns on wide screens (so every row lines up), one
 * stack on phones with the decision last and full width.
 */
export function ItemRow({
  titleId,
  itemId,
  title,
  lead,
  meta,
  byline,
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
  /** Inline facts under the title: municipality, kind, verified marker. */
  meta?: ReactNode;
  /** Who sent it and when; quieter than `meta`. */
  byline?: ReactNode;
  detail?: ReactNode;
  decision: ReactNode;
}) {
  const t = useTranslations("admin.queue.map");
  const frame = useItemFrame();
  const linked = frame !== null && itemId !== undefined;
  const selected = linked && frame.selectedId === itemId;
  const stacked = frame?.stacked === true;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the "Ver en el mapa" button is the keyboard path; the row click is a pointer shortcut
    <li
      id={itemId === undefined ? undefined : itemDomId(itemId)}
      aria-labelledby={titleId}
      aria-current={selected ? "true" : undefined}
      onClick={linked ? () => frame.onSelect(itemId) : undefined}
      className={cn(
        "grid gap-4 p-4 sm:p-5",
        !stacked &&
          "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_14rem] lg:gap-x-8",
        selected && "bg-muted/60 shadow-[inset_3px_0_0_var(--foreground)]",
      )}
    >
      <div className="flex min-w-0 gap-3">
        {lead}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h2
            id={titleId}
            title={typeof title === "string" ? title : undefined}
            className="line-clamp-2 text-[15px] leading-snug font-medium break-words"
          >
            {title}
          </h2>
          <MetaList>{facts(meta)}</MetaList>
          <div className="flex flex-col text-xs text-muted-foreground">
            {facts(byline).map((line, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static lines, never reordered
              <p key={index}>{line}</p>
            ))}
          </div>
          {linked ? (
            <Button
              variant="link"
              aria-pressed={selected}
              onClick={() => frame.onSelect(itemId)}
              className="h-auto w-fit p-0 has-[>svg]:px-0 pointer-coarse:min-h-11"
            >
              <LocateFixed aria-hidden />
              {t("showOnMap")}
            </Button>
          ) : null}
        </div>
      </div>
      {detail ? (
        <div className="flex min-w-0 flex-col gap-3">{detail}</div>
      ) : null}
      <div className={cn("min-w-0", !detail && !stacked && "lg:col-start-3")}>
        {decision}
      </div>
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
    <PropertyList className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
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
        "min-w-0 [overflow-wrap:anywhere] whitespace-pre-line",
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

/** "Recibido el 3 oct 2026 a las 4:05 p. m." from an ISO instant. */
export function useWhen() {
  const format = useFormatter();
  const t = useTranslations("admin.queue");
  return (key: "receivedAt" | "expiresAt", iso: string) => {
    const date = new Date(iso);
    return t(key, {
      date: format.dateTime(date, "short"),
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
 * the person's own, else a neutral tile with a user glyph. Decorative, since
 * the name sits right beside it.
 */
export function LeadImage({
  placeImage,
  personImage,
}: {
  placeImage?: string | null;
  personImage?: string | null;
}) {
  const source = placeImage ?? personImage ?? null;
  const person = !placeImage;
  return (
    <Avatar
      aria-hidden="true"
      className={cn(
        "size-12 shrink-0",
        person ? "rounded-full" : "rounded-(--radius-field)",
      )}
    >
      {source ? (
        <AvatarImage src={source} alt="" className="object-cover" />
      ) : null}
      <AvatarFallback
        className={cn(
          "bg-muted text-muted-foreground",
          person ? "rounded-full" : "rounded-(--radius-field)",
        )}
      >
        <UserRound className="size-5" />
      </AvatarFallback>
    </Avatar>
  );
}
