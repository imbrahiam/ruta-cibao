"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
  AdminPageHeader,
  AdminTableCard,
  AdminToolbar,
} from "@/components/admin/page-frame";
import { useUrlParam } from "@/components/admin/use-url-param";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { Placeholder } from "@/components/ui/loading";
import { Chip } from "@/components/ui/tag";
import { orpc } from "@/lib/web/api";
import { CASE_STATUSES, CaseStatusTag, PublicationTag } from "./case-tags";

/**
 * Case, municipality, status, support, replies, date: one grid for the header
 * and every row, so the columns line up on a wide screen. Below `md` the same
 * rows are stacked cards.
 */
const COLUMNS =
  "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_9.5rem_6.5rem_7.5rem_7rem]";

/**
 * Citizen cases for triage. Opens on what waits for an answer; every filter
 * lives in the address so a reload or a shared link shows the same list.
 */
export function CaseList() {
  const consultations = useTranslations("consultations");
  const t = useTranslations("admin");
  const c = useTranslations("admin.cases");
  const format = useFormatter();
  const municipality = useMunicipalityFilter();
  const [rawStatus, setStatus] = useUrlParam("status", "open");
  const [category, setCategory] = useUrlParam("category");
  const [moreError, setMoreError] = useState<unknown>(null);
  const status = consultationStatus(rawStatus);

  const categories = useQuery(orpc.consultations.categories.queryOptions());

  const list = useInfiniteQuery(
    consultationListOptions({ municipalityId: municipality, category, status }),
  );

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const total = list.data?.pages.at(-1)?.total ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={c("title")}
        description={c("lede")}
        actions={
          <ButtonLink href="/admin/queue/consultations" size="sm">
            {c("pendingQueue")}
          </ButtonLink>
        }
      />

      <AdminToolbar>
        <MunicipalityFilter />
        <div className="flex max-w-xs flex-col gap-1.5">
          <label htmlFor="case-category" className="text-[14px] font-medium">
            {c("category")}
          </label>
          <Select
            id="case-category"
            value={category}
            disabled={categories.isPending}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{c("allCategories")}</option>
            {(categories.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>
      </AdminToolbar>

      <fieldset className="scrollbar-none -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        <legend className="sr-only">{c("statusGroup")}</legend>
        <Chip selected={status === "all"} onClick={() => setStatus("all")}>
          {c("all")}
        </Chip>
        {CASE_STATUSES.map((value) => (
          <Chip
            key={value}
            selected={status === value}
            onClick={() => setStatus(value)}
          >
            {t(value)}
          </Chip>
        ))}
      </fieldset>

      {list.isPending ? (
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">{t("loading")}</span>
          {[0, 1, 2].map((key) => (
            <Placeholder key={key} className="h-32 md:h-16" />
          ))}
        </div>
      ) : list.isError ? (
        <ErrorPanel error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("empty")}
          body={c("emptyHint")}
        />
      ) : (
        <div className="flex flex-col gap-4" aria-busy={list.isFetching}>
          <p className="t-small text-ink-2" aria-live="polite">
            {c("shown", { shown: items.length, total })}
          </p>

          <AdminTableCard>
            <div
              aria-hidden
              className={`t-label hidden gap-4 border-b border-line bg-paper-2 px-4 py-2.5 text-ink-3 md:grid ${COLUMNS}`}
            >
              <span>{c("colCase")}</span>
              <span>{c("colMunicipality")}</span>
              <span>{c("colStatus")}</span>
              <span>{c("colSupport")}</span>
              <span>{c("colReplies")}</span>
              <span>{c("colDate")}</span>
            </div>

            <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-line">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/consultations/${item.slug}`}
                    className={`press grid grid-cols-2 items-center gap-x-4 gap-y-2.5 rounded-card bg-card p-4 shadow-ring hover:bg-paper-2 md:gap-y-0 md:rounded-none md:px-4 md:py-3 md:shadow-none ${COLUMNS}`}
                  >
                    <span className="order-3 col-span-2 flex min-w-0 flex-col gap-0.5 md:order-none md:col-span-1">
                      <span className="text-[16px] leading-snug font-medium text-ink">
                        {item.title}
                      </span>
                      <span className="t-small text-ink-2">
                        {item.categoryName}
                      </span>
                    </span>
                    <span className="t-small order-4 col-span-2 min-w-0 text-ink md:order-none md:col-span-1">
                      {item.municipalityName}
                    </span>
                    <span className="order-1 flex flex-wrap items-center gap-1.5 md:order-none">
                      <CaseStatusTag status={item.status} />
                      {item.publicationStatus === "published" ? null : (
                        <PublicationTag status={item.publicationStatus} />
                      )}
                    </span>
                    <span className="t-small order-5 text-ink-2 md:order-none">
                      {consultations("supports", { count: item.supportCount })}
                    </span>
                    <span className="t-small order-6 text-ink-2 md:order-none">
                      {c("replies", { count: item.responseCount })}
                    </span>
                    <span className="t-small order-2 justify-self-end text-ink-3 md:order-none md:justify-self-start">
                      {format.dateTime(new Date(item.createdAt), "short")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminTableCard>

          {list.hasNextPage ? (
            <div className="flex flex-col items-stretch gap-2 md:items-start">
              <Button
                size="lg"
                className="md:h-10"
                disabled={list.isFetchingNextPage}
                onClick={async () => {
                  setMoreError(null);
                  const next = await list.fetchNextPage();
                  if (next.isError) setMoreError(next.error);
                }}
              >
                {list.isFetchingNextPage ? c("loadingMore") : c("more")}
              </Button>
              <InlineError error={moreError} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
