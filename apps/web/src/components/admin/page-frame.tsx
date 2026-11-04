"use client";

import type { LucideIcon } from "lucide-react";
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
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            {title}
          </h1>
          {badge}
        </div>
        {typeof description === "string" ? (
          <p className="max-w-3xl text-base text-balance text-muted-foreground">
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
 * A hairline under the title is the only line; there is no card.
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
        <div className="flex min-h-8 items-center justify-between gap-3 border-b pb-2">
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
