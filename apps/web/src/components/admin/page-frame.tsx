"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { MetaList } from "./facts";

const PageTitleContext = createContext<{
  title: string | null;
  setTitle: (title: string | null) => void;
} | null>(null);

export function AdminPageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <PageTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function useAdminPageTitle() {
  return useContext(PageTitleContext)?.title;
}

/**
 * What this page is (title and one sentence) and what can be done here
 * (actions, on the title line). Where you are lives in the topbar.
 *
 * At most one primary and two secondary actions; anything more belongs in a
 * `⋯` menu.
 */
export function AdminPageHeader({
  title,
  description,
  badge,
  actions,
  children,
  id,
}: {
  title: string;
  description?: ReactNode;
  /** Sits beside the title, e.g. the record's status. */
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  id?: string;
}) {
  const setTitle = useContext(PageTitleContext)?.setTitle;
  useEffect(() => {
    setTitle?.(title);
    return () => setTitle?.(null);
  }, [title, setTitle]);

  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-[min(100%,20rem)] flex-1 space-y-1">
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1">
          <h1
            id={id}
            className="text-xl font-semibold tracking-tight text-balance"
          >
            {title}
          </h1>
          {badge}
        </div>
        {typeof description === "string" ? (
          <p className="max-w-3xl text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        ) : (
          description
        )}
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Filters on the left, page-level controls on the right of the same row. */
export function AdminToolbar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {children}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/**
 * A block of a page: a title with a muted count and an action, then content.
 * No rule under the title and no card: space and weight separate the blocks.
 */
export function AdminSection({
  title,
  count,
  action,
  children,
  className,
  id,
}: {
  title?: string;
  count?: number | string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={title && id ? `${id}-title` : undefined}
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      {title ? (
        <div className="flex min-h-8 items-center justify-between gap-3">
          <h2
            id={id ? `${id}-title` : undefined}
            className="flex items-baseline gap-2 text-[15px] font-medium"
          >
            {title}
            {count !== undefined ? (
              <span className="text-sm font-normal text-muted-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** The one bordered surface: a list or table. Cards never nest. */
export function AdminTableCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-(--radius-card) border bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Nothing here, said once: what this is and, if there is one, what to do. */
export function AdminEmpty({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

/**
 * A list read like an inbox, not a spreadsheet: one card with no rules between
 * rows (the owner finds stacked lines heavy). Rows are told apart by their
 * spacing and the hover background, each a title with its context under it
 * and a short summary at the end.
 */
export function InboxList({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  /** Names the list for screen readers when no heading does. */
  label?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-(--radius-card) border bg-card p-1.5",
        className,
      )}
    >
      {children}
    </ul>
  );
}

/**
 * One row of an `InboxList`. The whole row opens the record: the title's link
 * (or button) is stretched over it, so hover, click and the focus ring cover
 * the row, while `actions` (a download, say) stay their own controls above it.
 */
export function InboxRow({
  title,
  href,
  onOpen,
  openLabel,
  openId,
  onPrefetch,
  lead,
  badge,
  meta,
  byline,
  summary,
  actions,
  dense,
}: {
  title: string;
  href?: string;
  onOpen?: () => void;
  /** A fuller accessible name for the row's link, when the title is not enough. */
  openLabel?: string;
  openId?: string;
  onPrefetch?: () => void;
  /** A picture or glyph before the title. */
  lead?: ReactNode;
  /** Beside the title: a state worth naming, a short reference. */
  badge?: ReactNode;
  /** The context under the title; pass the facts as children of a fragment. */
  meta?: ReactNode;
  /** Who sent it and when, under the context: an avatar and a name, say. */
  byline?: ReactNode;
  /** Quiet figures at the end of the row (not interactive). */
  summary?: ReactNode;
  /** Controls of their own, kept clickable above the row's link. */
  actions?: ReactNode;
  /** One-line rows (a name and little else) sit tighter. */
  dense?: boolean;
}) {
  const stretched =
    "outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50";
  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 rounded-[10px] px-3 transition-colors hover:bg-accent/70",
        dense ? "min-h-12 py-2" : "min-h-14 py-3",
      )}
    >
      {lead}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 truncate text-[15px] leading-snug font-medium">
            {href ? (
              <Link
                href={href}
                id={openId}
                aria-label={openLabel}
                onPointerEnter={onPrefetch}
                onFocus={onPrefetch}
                className={stretched}
              >
                {title}
              </Link>
            ) : (
              <button
                type="button"
                id={openId}
                aria-label={openLabel}
                onClick={onOpen}
                className={cn("text-left", stretched)}
              >
                {title}
              </button>
            )}
          </p>
          {badge}
        </div>
        {meta ? (
          <MetaList className="text-[13px] max-sm:hidden">{meta}</MetaList>
        ) : null}
        {byline ? (
          <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
            {byline}
          </div>
        ) : null}
        {meta || summary ? (
          // On a phone the figures join the context line instead of being cut.
          <MetaList className="text-[13px] tabular-nums sm:hidden">
            {meta}
            {summary}
          </MetaList>
        ) : null}
      </div>
      {summary ? (
        <div className="hidden shrink-0 items-center gap-4 text-sm text-muted-foreground tabular-nums sm:flex">
          {summary}
        </div>
      ) : null}
      {actions ? (
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          {actions}
        </div>
      ) : null}
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </li>
  );
}
