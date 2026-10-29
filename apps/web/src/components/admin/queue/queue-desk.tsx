"use client";

import {
  keepPreviousData,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Fragment, type ReactNode, useRef } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { moderationQueueOptions, pendingRoutesOptions } from "../list-queries";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "../municipality-filter";
import { AdminPageHeader, AdminTableCard, AdminToolbar } from "../page-frame";
import { QueryState } from "../query-state";
import { CaseRow } from "./case-row";
import { ClaimRow } from "./claim-row";
import { ContentReportRow } from "./content-report-row";
import { ColumnHeader } from "./item-parts";
import { PhotoRow } from "./photo-row";
import { PlaceRow } from "./place-row";
import { ReportRow } from "./report-row";
import { RouteRow } from "./route-row";
import { QUEUE_LIMIT, type QueueSlug } from "./slugs";
import { TrafficRow } from "./traffic-row";
import { DeskContext, useDeskActions } from "./use-decision";

/** `admin` catalogue keys for each desk's title and intro. */
const TITLE: Record<QueueSlug, string> = {
  places: "places",
  claims: "claims",
  photos: "photos",
  reports: "reports",
  routes: "routes",
  traffic: "traffic",
  "content-reports": "safety",
  consultations: "consultations",
};

const INTRO: Record<QueueSlug, string> = {
  places: "places",
  claims: "claims",
  photos: "photos",
  reports: "reports",
  routes: "routes",
  traffic: "traffic",
  "content-reports": "contentReports",
  consultations: "consultations",
};

type Row = { key: string; node: ReactNode };

/**
 * The moderation desk for one queue: a title and count, the municipality
 * filter, a refresh, and the items waiting for a decision.
 *
 * Every queue shares this frame and the decision controls; only the card in
 * the middle differs. Decisions refetch the list in place: the filter lives in
 * the URL and nothing here navigates or scrolls.
 */
export function QueueDesk({ queue }: { queue: QueueSlug }) {
  return queue === "routes" ? <RoutesDesk /> : <ModerationDesk queue={queue} />;
}

function ModerationDesk({ queue }: { queue: Exclude<QueueSlug, "routes"> }) {
  const municipalityId = useMunicipalityFilter();
  const query = useQuery({
    ...moderationQueueOptions(queue, municipalityId),
    placeholderData: keepPreviousData,
  });

  return (
    <Desk
      slug={queue}
      query={query}
      rows={(data): Row[] => {
        switch (queue) {
          case "places":
            return data.places.map((place) => ({
              key: place.id,
              node: <PlaceRow place={place} />,
            }));
          case "claims":
            return data.claims.map((claim) => ({
              key: claim.id,
              node: <ClaimRow claim={claim} />,
            }));
          case "photos":
            return data.photos.map((photo) => ({
              key: photo.id,
              node: <PhotoRow photo={photo} />,
            }));
          case "reports":
            return data.reports.map((report) => ({
              key: report.id,
              node: <ReportRow report={report} />,
            }));
          case "traffic":
            return data.traffic.map((report) => ({
              key: report.id,
              node: <TrafficRow report={report} />,
            }));
          case "content-reports":
            return data.contentReports.map((report) => ({
              key: report.id,
              node: <ContentReportRow report={report} />,
            }));
          case "consultations":
            return data.consultations.map((item) => ({
              key: item.id,
              node: <CaseRow item={item} />,
            }));
        }
      }}
    />
  );
}

function RoutesDesk() {
  const municipalityId = useMunicipalityFilter();
  const query = useQuery({
    ...pendingRoutesOptions(municipalityId),
    placeholderData: keepPreviousData,
  });

  return (
    <Desk
      slug="routes"
      query={query}
      rows={(data) =>
        data.items.map((route) => ({
          key: route.id,
          node: <RouteRow route={route} />,
        }))
      }
    />
  );
}

function Desk<T>({
  slug,
  query,
  rows,
}: {
  slug: QueueSlug;
  query: UseQueryResult<T, Error>;
  rows: (data: T) => Row[];
}) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const region = useRef<HTMLElement>(null);
  const actions = useDeskActions(region);

  return (
    <DeskContext.Provider value={actions}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          id="queue-title"
          title={t(TITLE[slug])}
          description={q(`intro.${INTRO[slug]}`)}
        />

        <AdminToolbar
          actions={
            <Button
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="min-h-11 md:min-h-0"
            >
              <RefreshCw aria-hidden />
              {query.isFetching ? t("shell.updating") : t("refresh")}
            </Button>
          }
        >
          <MunicipalityFilter />
        </AdminToolbar>

        <section
          ref={region}
          aria-labelledby="queue-title"
          tabIndex={-1}
          className="flex flex-col gap-4 outline-none"
        >
          <QueryState query={query}>
            {(data) => {
              const items = rows(data);
              if (items.length === 0) {
                return (
                  <EmptyState
                    icon={CheckCircle2}
                    title={q("emptyTitle")}
                    body={t("empty")}
                  />
                );
              }
              return (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <p role="status" className="t-small font-medium text-ink">
                      {q("count", { count: items.length })}
                    </p>
                    {items.length >= QUEUE_LIMIT ? (
                      <p className="t-small text-ink-2">
                        {q("mayBeMore", { count: QUEUE_LIMIT })}
                      </p>
                    ) : null}
                  </div>
                  <AdminTableCard>
                    <ColumnHeader />
                    <ul className="flex flex-col gap-3 md:gap-0 md:divide-y md:divide-line">
                      {items.map((row) => (
                        <Fragment key={row.key}>{row.node}</Fragment>
                      ))}
                    </ul>
                  </AdminTableCard>
                </div>
              );
            }}
          </QueryState>
        </section>
      </div>
    </DeskContext.Provider>
  );
}
