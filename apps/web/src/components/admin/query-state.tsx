"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ErrorPanel, errorMessageKey } from "./error-panel";

/**
 * Loading, failure and data for one query, in one place.
 *
 * Nothing shows until there is something to show: while the first answer is
 * on its way the screen passes the `skeleton` shaped like its result, so
 * nothing jumps when data lands. Once data exists it stays on screen through
 * every refetch (the only trace is `aria-busy`, for assistive technology), and
 * a refetch that fails leaves the data in place with a quiet notice above it.
 */
export function QueryState<T>({
  query,
  skeleton,
  children,
}: {
  query: UseQueryResult<T, Error>;
  /** Shaped exactly like the loaded content: same rows, columns, heights. */
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const t = useTranslations("admin");
  const common = useTranslations("common");

  if (query.data === undefined) {
    if (query.isError) {
      return <ErrorPanel error={query.error} onRetry={() => query.refetch()} />;
    }
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">{t("loading")}</span>
        {skeleton}
      </div>
    );
  }

  return (
    <div aria-busy={query.isFetching} className="flex min-w-0 flex-col gap-3">
      {query.isRefetchError ? (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-x-3 text-sm text-destructive"
        >
          {t(errorMessageKey(query.error))}
          <Button
            variant="link"
            size="sm"
            onClick={() => query.refetch()}
            className="h-auto p-0"
          >
            {common("retry")}
          </Button>
        </p>
      ) : null}
      {children(query.data)}
    </div>
  );
}
