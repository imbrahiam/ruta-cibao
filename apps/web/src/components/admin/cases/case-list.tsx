"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { ErrorPanel, InlineError } from "@/components/admin/error-panel";
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
  AdminTableCard,
  AdminToolbar,
} from "@/components/admin/page-frame";
import { TableRowsSkeleton } from "@/components/admin/skeletons";
import { useStaff } from "@/components/admin/staff-context";
import { useAdminPrefetch } from "@/components/admin/use-admin-prefetch";
import { useUrlParam } from "@/components/admin/use-url-param";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpc } from "@/lib/web/api";
import { CASE_STATUSES, CaseStatusTag } from "./case-tags";

/** Radix items cannot carry an empty value, so "all topics" travels as this. */
const ALL = "__all__";

const HEAD = "h-10 text-xs font-normal text-muted-foreground";
const CELL = "py-1.5";

/** One placeholder row: the same columns, at the same breakpoints, as a case. */
const SKELETON_CELLS = [
  { cell: "w-full max-w-0", bars: ["h-4 w-2/5", "h-3.5 w-1/4"] },
  { cell: "hidden md:table-cell", bars: ["h-4 w-24"] },
  { bars: ["h-5 w-20"] },
  { cell: "hidden sm:table-cell", bars: ["ml-auto h-4 w-6"] },
  { cell: "hidden md:table-cell", bars: ["ml-auto h-4 w-6"] },
  { cell: "hidden sm:table-cell", bars: ["h-4 w-20"] },
];

/**
 * Citizen cases for triage. Opens on what waits for an answer; every filter
 * lives in the address so a reload or a shared link shows the same list.
 */
export function CaseList() {
  const t = useTranslations("admin");
  const c = useTranslations("admin.cases");
  const format = useFormatter();
  const municipality = useMunicipalityFilter();
  const [rawStatus, setStatus] = useUrlParam("status", "open");
  const [category, setCategory] = useUrlParam("category");
  const [moreError, setMoreError] = useState<unknown>(null);
  const status = consultationStatus(rawStatus);

  const categories = useQuery(orpc.consultations.categories.queryOptions());

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
  const total = list.data?.pages.at(-1)?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={c("title")}
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/queue/consultations">{c("pendingQueue")}</Link>
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
              <SelectTrigger aria-label={c("category")} className="min-w-48">
                <span className="text-muted-foreground">{c("category")}</span>
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
          className="max-w-full min-w-0 overflow-x-auto scrollbar-none"
        >
          <TabsList variant="pill" aria-label={c("statusGroup")}>
            <TabsTrigger value="all">{c("all")}</TabsTrigger>
            {CASE_STATUSES.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(value)}
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
          <AdminTableCard>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={HEAD}>{c("colCase")}</TableHead>
                  <TableHead className={`${HEAD} hidden md:table-cell`}>
                    {c("colMunicipality")}
                  </TableHead>
                  <TableHead className={HEAD}>{c("colStatus")}</TableHead>
                  <TableHead
                    className={`${HEAD} hidden text-right sm:table-cell`}
                  >
                    {c("colSupport")}
                  </TableHead>
                  <TableHead
                    className={`${HEAD} hidden text-right md:table-cell`}
                  >
                    {c("colReplies")}
                  </TableHead>
                  <TableHead className={`${HEAD} hidden sm:table-cell`}>
                    {c("colDate")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!list.data ? (
                  <TableRowsSkeleton
                    rows={5}
                    rowClassName="h-12"
                    cells={SKELETON_CELLS}
                  />
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id} className="h-12">
                      <TableCell className={`${CELL} w-full max-w-0`}>
                        <Link
                          href={`/admin/consultations/${item.slug}`}
                          onPointerEnter={() =>
                            prefetch(`/admin/consultations/${item.slug}`)
                          }
                          onFocus={() =>
                            prefetch(`/admin/consultations/${item.slug}`)
                          }
                          title={item.title}
                          className="block truncate font-medium hover:underline"
                        >
                          {item.title}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.categoryName}
                        </span>
                      </TableCell>
                      <TableCell className={`${CELL} hidden md:table-cell`}>
                        {item.municipalityName}
                      </TableCell>
                      <TableCell className={CELL}>
                        <CaseStatusTag status={item.status} />
                        {item.publicationStatus === "published" ? null : (
                          <span className="block text-xs text-muted-foreground">
                            {c(`publication.${item.publicationStatus}`)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`${CELL} hidden text-right tabular-nums sm:table-cell`}
                      >
                        {item.supportCount}
                      </TableCell>
                      <TableCell
                        className={`${CELL} hidden text-right tabular-nums md:table-cell`}
                      >
                        {item.responseCount}
                      </TableCell>
                      <TableCell
                        className={`${CELL} hidden text-muted-foreground tabular-nums sm:table-cell`}
                      >
                        {format.dateTime(new Date(item.createdAt), "short")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </AdminTableCard>

          {list.data ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p
                  className="text-xs text-muted-foreground tabular-nums"
                  aria-live="polite"
                >
                  {c("shown", { shown: items.length, total })}
                </p>
                {list.hasNextPage ? (
                  <Button
                    variant="outline"
                    disabled={list.isFetchingNextPage}
                    onClick={async () => {
                      setMoreError(null);
                      const next = await list.fetchNextPage();
                      if (next.isError) setMoreError(next.error);
                    }}
                  >
                    {list.isFetchingNextPage ? c("loadingMore") : c("more")}
                  </Button>
                ) : null}
              </div>
              <InlineError error={moreError} />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
