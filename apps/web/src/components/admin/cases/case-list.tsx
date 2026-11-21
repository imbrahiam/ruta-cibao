"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { ArrowRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "use-intl";
import { ErrorPanel } from "@/components/admin/error-panel";
import {
  consultationListOptions,
  consultationStatus,
} from "@/components/admin/list-queries";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "@/components/admin/municipality-filter";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminToolbar,
  InboxList,
} from "@/components/admin/page-frame";
import { useStaff } from "@/components/admin/staff-context";
import { useAdminPrefetch } from "@/components/admin/use-admin-prefetch";
import { useUrlParam } from "@/components/admin/use-url-param";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/lib/web/api";
import { ListMore } from "../list-more";
import { CaseInboxRow } from "./case-inbox-row";
import { CASE_STATUSES } from "./case-tags";

/** Radix items cannot carry an empty value, so "all topics" travels as this. */
const ALL = "__all__";

/** Placeholder rows in the shape of the inbox: title, context, figure. */
function InboxSkeleton() {
  return (
    <ul className="flex flex-col">
      {Array.from({ length: 5 }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
        <li key={index} className="flex min-h-16 items-center gap-3 py-3">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  );
}

type Recency = "today" | "week" | "month" | "earlier";

/**
 * The list in a few time groups (today, this week, this month, before), so a
 * long inbox has landmarks and what is new reads first. Items arrive newest
 * first, so each group keeps that order.
 */
function groupByRecency<T extends { createdAt: string }>(
  items: readonly T[],
): { key: Recency; items: T[] }[] {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const bucket = (createdAt: string): Recency => {
    const time = new Date(createdAt).getTime();
    if (time >= startOfToday.getTime()) return "today";
    if (time >= startOfToday.getTime() - 6 * day) return "week";
    if (time >= startOfToday.getTime() - 29 * day) return "month";
    return "earlier";
  };
  const groups: { key: Recency; items: T[] }[] = [];
  for (const item of items) {
    const key = bucket(item.createdAt);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

/**
 * Citizen cases for triage. Opens on what waits for an answer; every filter
 * lives in the address so a reload or a shared link shows the same list.
 */
export function CaseList() {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cases");
  // The tabs speak the same words as the status tags in the rows.
  const statusLabel = useTranslations("consultations.statusLabel");
  const municipality = useMunicipalityFilter();
  const [rawStatus, setStatus] = useUrlParam("status", "open");
  const [category, setCategory] = useUrlParam("category");
  const status = consultationStatus(rawStatus);

  const categories = useQuery(orpc.consultations.categories.queryOptions());
  const waiting = useQuery(orpc.moderation.counts.queryOptions()).data
    ?.consultations;

  const prefetch = useAdminPrefetch(useStaff());

  // Changing a filter keeps the rows on screen until the new ones are in.
  const list = useInfiniteQuery({
    ...consultationListOptions({
      municipalityId: municipality,
      category,
      status,
    }),
    placeholderData: keepPreviousData,
  });

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const duplicated = new Set(
    items
      .map((item) => item.title)
      .filter((title, index, all) => all.indexOf(title) !== index),
  );
  const total = list.data?.pages.at(-1)?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={c("title")}
        actions={
          <Button variant="outline" asChild>
            <Link
              href="/admin/queue/consultations"
              aria-label={
                waiting
                  ? `${c("pendingQueue")}, ${t("shell.pendingCount", { count: waiting })}`
                  : undefined
              }
            >
              {c("pendingQueue")}
              {/* How many wait there, so the way in says whether it is worth
                  taking. */}
              {waiting ? (
                <Badge
                  variant="secondary"
                  className="-mr-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums"
                >
                  {waiting}
                </Badge>
              ) : null}
              {/* It leads to another view (the queue), not a filter here. */}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />

      <AdminToolbar
        actions={
          <>
            <MunicipalityFilter />
            <Select
              value={category || ALL}
              disabled={categories.isPending}
              onValueChange={(next) => setCategory(next === ALL ? "" : next)}
            >
              <SelectTrigger
                aria-label={c("category")}
                className="min-w-0 sm:min-w-48"
              >
                <span className="hidden text-muted-foreground sm:inline">
                  {c("category")}
                </span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{c("allCategories")}</SelectItem>
                {(categories.data ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      >
        <Tabs
          value={status}
          onValueChange={setStatus}
          className="max-w-full min-w-0"
        >
          {/* Wraps instead of scrolling: on a phone the last states were cut
              off with nothing hinting they were there. */}
          <TabsList
            variant="pill"
            aria-label={c("statusGroup")}
            className="h-auto! flex-wrap justify-start *:flex-none"
          >
            <TabsTrigger value="all">{c("all")}</TabsTrigger>
            {CASE_STATUSES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {statusLabel(value)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </AdminToolbar>

      {list.isError && !list.data ? (
        <ErrorPanel error={list.error} onRetry={() => list.refetch()} />
      ) : list.data && items.length === 0 ? (
        <AdminEmpty
          icon={MessagesSquare}
          title={t("empty")}
          description={c("emptyHint")}
        />
      ) : (
        <div className="flex flex-col gap-3" aria-busy={list.isFetching}>
          {list.data ? null : (
            <span role="status" className="sr-only">
              {t("loading")}
            </span>
          )}
          {!list.data ? (
            <InboxSkeleton />
          ) : (
            <div className="flex max-w-3xl flex-col gap-8">
              {groupByRecency(items).map((group) => (
                <section
                  key={group.key}
                  aria-labelledby={`cases-${group.key}`}
                  className="flex flex-col gap-1"
                >
                  <h2
                    id={`cases-${group.key}`}
                    className="text-[13px] font-medium text-muted-foreground"
                  >
                    {c(`groups.${group.key}`)}
                  </h2>
                  <InboxList>
                    {group.items.map((item) => {
                      const href = `/admin/consultations/${item.slug}`;
                      return (
                        <CaseInboxRow
                          key={item.id}
                          item={item}
                          href={href}
                          // Two cases with the same words get a short
                          // reference, so they can be told apart.
                          reference={
                            duplicated.has(item.title)
                              ? item.id.slice(-6)
                              : undefined
                          }
                          onPrefetch={() => prefetch(href)}
                          // Under a status tab every row has that status.
                          showStatus={status === "all"}
                        />
                      );
                    })}
                  </InboxList>
                </section>
              ))}
            </div>
          )}

          {list.data ? (
            <ListMore
              shown={items.length}
              total={total}
              hasMore={list.hasNextPage}
              loading={list.isFetchingNextPage}
              onMore={() => list.fetchNextPage()}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
