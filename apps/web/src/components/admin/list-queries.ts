"use client";

import type { QueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/web/api";
import { CASE_STATUSES, type CaseStatus } from "./cases/case-tags";
import type { CategoryKind } from "./categories/category-form";
import {
  isQueueSlug,
  QUEUE_LIMIT,
  QUEUES,
  type QueueSlug,
} from "./queue/slugs";
import type { Staff } from "./staff-context";

export function resolveMunicipalityFilter(
  params: Pick<URLSearchParams, "get">,
  scope: Staff["staffScope"],
): string | undefined {
  return Array.isArray(scope) && scope.length === 1
    ? scope[0]
    : params.get("municipality") || undefined;
}

/**
 * How often an open queue re-reads itself while its tab is in front, so new
 * items and other moderators' decisions show up without a refresh button.
 * Leaving and coming back to the tab re-reads it at once.
 */
export const QUEUE_POLL_MS = 30_000;

export function moderationQueueOptions(
  queue: Exclude<QueueSlug, "routes">,
  municipalityId?: string,
) {
  return orpc.moderation.queue.queryOptions({
    input: { queue: QUEUES[queue].api, municipalityId, limit: QUEUE_LIMIT },
  });
}

export function pendingRoutesOptions(municipalityId?: string) {
  return orpc.routes.browse.queryOptions({
    input: { scope: "pending", municipalityId, limit: QUEUE_LIMIT },
  });
}

export function consultationStatus(value: string | null): CaseStatus | "all" {
  return value === "all" || CASE_STATUSES.some((status) => status === value)
    ? (value as CaseStatus | "all")
    : "open";
}

export function consultationListOptions({
  municipalityId,
  category = "",
  status = "open",
}: {
  municipalityId?: string;
  category?: string;
  status?: CaseStatus | "all";
}) {
  return orpc.consultations.browse.infiniteOptions({
    input: (offset: number) => ({
      municipality: municipalityId ?? "",
      category,
      status: status === "all" ? undefined : status,
      mine: false,
      offset,
      limit: 24,
    }),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastOffset) => {
      const next = lastOffset + last.items.length;
      return last.items.length > 0 && next < last.total ? next : undefined;
    },
  });
}

export function weeklyReportOptions(municipalityId?: string) {
  return orpc.reports.list.queryOptions({
    input: { municipalityId, limit: 26 },
  });
}

export function catalogOptions(kind: CategoryKind) {
  return orpc.catalog.list.queryOptions({ input: { kind } });
}

export function catalogKind(value: string | null): CategoryKind {
  switch (value) {
    case "business":
    case "route":
    case "traffic":
    case "consultation":
      return value;
    default:
      return "place";
  }
}

/** Warm the same cache entries the destination reads; auth remains server-enforced. */
export function prefetchAdminRoute(
  client: QueryClient,
  href: string,
  staff: Staff,
): Promise<void> {
  const url = new URL(href, "http://localhost");
  const municipalityId = resolveMunicipalityFilter(
    url.searchParams,
    staff.staffScope,
  );

  if (url.pathname === "/admin") {
    return client.prefetchQuery(orpc.moderation.counts.queryOptions());
  }
  if (url.pathname.startsWith("/admin/queue/")) {
    const queue = url.pathname.slice("/admin/queue/".length);
    if (isQueueSlug(queue)) {
      return queue === "routes"
        ? client.prefetchQuery(pendingRoutesOptions(municipalityId))
        : client.prefetchQuery(moderationQueueOptions(queue, municipalityId));
    }
  }
  const detail = url.pathname.match(
    /^\/admin\/(consultations|reports)\/([^/]+)$/,
  );
  if (detail?.[1] === "consultations") {
    return client.prefetchQuery(
      orpc.consultations.detail.queryOptions({
        input: { slug: decodeURIComponent(detail[2] ?? "") },
      }),
    );
  }
  if (detail?.[1] === "reports") {
    return client.prefetchQuery(
      orpc.reports.detail.queryOptions({
        input: { reportId: decodeURIComponent(detail[2] ?? "") },
      }),
    );
  }
  if (url.pathname === "/admin/reports") {
    return client.prefetchQuery(weeklyReportOptions(municipalityId));
  }
  if (url.pathname === "/admin/consultations") {
    return Promise.all([
      client.prefetchQuery(orpc.consultations.categories.queryOptions()),
      client.prefetchInfiniteQuery(
        consultationListOptions({
          municipalityId,
          category: url.searchParams.get("category") ?? "",
          status: consultationStatus(url.searchParams.get("status")),
        }),
      ),
    ]).then(() => undefined);
  }
  if (url.pathname === "/admin/categories" && staff.staffRole === "admin") {
    return client.prefetchQuery(
      catalogOptions(catalogKind(url.searchParams.get("kind"))),
    );
  }
  return Promise.resolve();
}
