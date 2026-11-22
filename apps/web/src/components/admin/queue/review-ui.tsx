"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useFormatter, useNow } from "use-intl";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";

const PILL_TONE = {
  neutral: "border-border text-foreground/75",
  brand: "border-primary/45 text-primary",
  red: "border-red-600/40 text-red-700 dark:border-red-400/40 dark:text-red-300",
  amber:
    "border-amber-600/45 text-amber-800 dark:border-amber-400/40 dark:text-amber-300",
  blue: "border-sky-600/40 text-sky-800 dark:border-sky-400/40 dark:text-sky-300",
} as const;

export type PillTone = keyof typeof PILL_TONE;

/** A short fact or state in an outlined pill; the colour carries the state. */
export function Pill({
  tone = "neutral",
  icon: Icon,
  children,
}: {
  tone?: PillTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        PILL_TONE[tone],
      )}
    >
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" /> : null}
      {children}
    </span>
  );
}

/** "hace 5 horas", kept true while the desk stays open. */
export function Ago({ iso, className }: { iso: string; className?: string }) {
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  return (
    <time dateTime={iso} className={cn("tabular-nums", className)}>
      {format.relativeTime(new Date(iso), now)}
    </time>
  );
}

/**
 * One item in a desk's list. Two lines, the same in every queue, so the eye
 * learns where things are: the name and how long ago on the first, where or
 * what on the second, with at most one pill at its end.
 */
export function ReviewLine({
  selected,
  onSelect,
  lead,
  title,
  end,
  meta,
  flag,
}: {
  selected: boolean;
  onSelect: () => void;
  /** A 40 px tile that names the kind of item or the person behind it. */
  lead: ReactNode;
  title: string;
  /** At the end of the first line: how long ago, or until when. */
  end: ReactNode;
  meta: ReactNode;
  /** At the end of the second line: the one state worth a pill. */
  flag?: ReactNode;
}) {
  return (
    <li
      aria-current={selected ? "true" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-colors",
        selected ? "bg-primary/[0.08]" : "hover:bg-accent/70",
      )}
    >
      {lead}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            title={title}
            onClick={onSelect}
            className="min-w-0 flex-1 truncate text-left text-[15px] leading-snug font-semibold outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
          >
            {title}
          </button>
          <span className="shrink-0 text-xs text-muted-foreground">{end}</span>
        </div>
        <div className="flex h-6 items-center gap-2 text-[13px] text-muted-foreground">
          <span className="min-w-0 flex-1 truncate">{meta}</span>
          {flag}
        </div>
      </div>
    </li>
  );
}

/** The 40 px square a line or a sheet opens with, for a glyph. */
export function GlyphTile({
  icon: Icon,
  large,
}: {
  icon: LucideIcon;
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center bg-muted text-muted-foreground",
        large ? "size-12 rounded-xl" : "size-10 rounded-[10px]",
      )}
    >
      <Icon aria-hidden className={large ? "size-6" : "size-5"} />
    </span>
  );
}

/**
 * The selected item, as a sheet: who or what it is on top, the evidence in
 * the middle, and the decision pinned to the foot, always in the same place
 * however long the item is.
 */
export function ReviewSheet({
  titleId,
  lead,
  title,
  pills,
  actions,
  children,
  footer,
}: {
  titleId: string;
  lead?: ReactNode;
  title: string;
  /** Under the title: what kind of thing it is and where, as pills. */
  pills?: ReactNode;
  /** Ways out to the subject itself, at the title's end. */
  actions?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <article
      aria-labelledby={titleId}
      className="flex min-h-full flex-1 flex-col"
    >
      <header className="flex items-start gap-4 px-6 pt-6">
        {lead}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2
            id={titleId}
            className="text-[22px] leading-tight font-semibold tracking-tight text-balance"
          >
            {title}
          </h2>
          {pills ? (
            <div className="flex flex-wrap items-center gap-1.5">{pills}</div>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      <div className="flex flex-col gap-5 px-6 py-5">{children}</div>
      <footer className="sticky bottom-0 z-10 mt-auto border-t bg-card px-6 py-3">
        {footer}
      </footer>
    </article>
  );
}

/** The item's facts in one bordered block, two to a row, split by hairlines. */
export function Ficha({ children }: { children: ReactNode }) {
  return (
    <dl className="grid overflow-hidden rounded-xl border bg-border [gap:1px] sm:grid-cols-2 sm:[&>div:last-child:nth-child(odd)]:col-span-2">
      {children}
    </dl>
  );
}

/** One fact: a quiet label over its value. Empty values are left out. */
export function FichaItem({
  label,
  wide,
  children,
}: {
  label: string;
  /** Takes the whole row: free text, or the odd fact out. */
  wide?: boolean;
  children?: ReactNode;
}) {
  if (children === null || children === undefined || children === "")
    return null;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 bg-card px-4 py-3",
        wide && "sm:col-span-2",
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-[15px] [overflow-wrap:anywhere] whitespace-pre-line">
        {children}
      </dd>
    </div>
  );
}

/** The sender's own words, set apart from the desk's: a tinted note. */
export function Quote({
  label,
  state,
  children,
}: {
  label?: string;
  /** Whether the words are public yet, when that needs saying. */
  state?: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-1.5 rounded-xl bg-primary/[0.06] px-4 py-3">
      {label || state ? (
        <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {label}
          {state}
        </figcaption>
      ) : null}
      <blockquote className="max-w-prose text-[15px] leading-relaxed text-pretty [overflow-wrap:anywhere] whitespace-pre-line">
        {children}
      </blockquote>
    </figure>
  );
}

/** A person as a value: their face (with the resident seal) and their name. */
export function Sender({
  name,
  image = null,
  verified,
  anonymous,
}: {
  name: string | null;
  image?: string | null;
  /** The seal's words when the person is a verified resident. */
  verified?: string;
  /** What to call someone with no name. */
  anonymous: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <PersonAvatar
        name={name}
        image={image}
        className="size-6"
        verified={verified}
      />
      <span className="truncate">{name ?? anonymous}</span>
    </span>
  );
}
