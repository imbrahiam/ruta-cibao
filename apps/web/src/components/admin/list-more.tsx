"use client";

import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { InlineError } from "./error-panel";

/**
 * The foot of a long list: how much of it is on screen, and the next page.
 *
 * The next page loads by itself as the foot nears the viewport, so scrolling
 * just keeps going; the button stays for keyboards, screen readers and the
 * moment the automatic load fails. Lists here only grow, so every one of them
 * pages instead of loading everything at once.
 */
export function ListMore({
  shown,
  total,
  hasMore,
  loading,
  onMore,
  sentinel,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  /** Loads the next page and resolves to its error, if it failed. */
  onMore: () => Promise<{ isError: boolean; error: unknown }>;
  /**
   * The end of the list, when this foot sits outside the box that scrolls it
   * (always in view, under the list): that end, not the foot, decides when the
   * next page loads.
   */
  sentinel?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("admin.shell");
  const foot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<unknown>(null);
  // After a failure the list waits for a deliberate retry instead of looping.
  const automatic = hasMore && !loading && error === null;

  const more = async () => {
    setError(null);
    const result = await onMore();
    if (result.isError) setError(result.error);
  };
  const moreRef = useRef(more);
  moreRef.current = more;

  useEffect(() => {
    const element = sentinel?.current ?? foot.current;
    if (!element || !automatic) return;
    // Inside a list that scrolls on its own, watch that box; else the page.
    const scroller = element.closest<HTMLElement>("[data-scroll-root]");
    const root =
      scroller && getComputedStyle(scroller).overflowY !== "visible"
        ? scroller
        : null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting))
          void moreRef.current();
      },
      // Start a screen early, so the rows are there by the time they are reached.
      { root, rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [automatic, sentinel]);

  if (total === 0) return null;

  return (
    <div ref={foot} className="flex flex-col gap-2 pt-1">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("listShown", { shown: Math.min(shown, total), total })}
        </p>
        {hasMore ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            aria-busy={loading}
            onClick={more}
          >
            {loading ? t("listLoadingMore") : t("listMore")}
          </Button>
        ) : null}
      </div>
      <InlineError error={error} />
    </div>
  );
}
