"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Placeholder } from "@/components/ui/loading";
import { ErrorPanel } from "./error-panel";

/**
 * Loading, failure and data for one query, in one place.
 *
 * Loading is placeholder cards shaped like the result, so nothing jumps; a
 * background refetch keeps the current data on screen and only changes the
 * `aria-busy` flag.
 */
export function QueryState<T>({
  query,
  children,
  placeholders = 3,
}: {
  query: UseQueryResult<T, Error>;
  children: (data: T) => ReactNode;
  placeholders?: number;
}) {
  const t = useTranslations("admin");

  if (query.isPending) {
    return (
      <div role="status" aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">{t("loading")}</span>
        {Array.from({ length: placeholders }, (_, index) => (
          // Static placeholders, never reordered.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
          <Placeholder key={index} className="h-36" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <ErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  }

  return <div aria-busy={query.isFetching}>{children(query.data)}</div>;
}
