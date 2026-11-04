"use client";

import type { ApiOutputs } from "@ruta/contracts";
import {
  keepPreviousData,
  type UseQueryResult,
  useQuery,
} from "@tanstack/react-query";
import { CheckCircle2, RefreshCw } from "lucide-react";
import {
  type FocusEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { moderationQueueOptions, pendingRoutesOptions } from "../list-queries";
import { placeMapItem, routeMapItem, trafficMapItem } from "../map/queue-items";
import { QueueMapLayout, type QueueMapSpec } from "../map/queue-map-view";
import { useMapCopy } from "../map/use-map-copy";
import { useQueueView, ViewToggle } from "../map/view-toggle";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "../municipality-filter";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminTableCard,
  AdminToolbar,
} from "../page-frame";
import { QueryState } from "../query-state";
import { QueueSkeleton } from "../skeletons";
import { CaseRow } from "./case-row";
import { ClaimRow } from "./claim-row";
import { ContentReportRow } from "./content-report-row";
import { PhotoRow } from "./photo-row";
import { PlaceRow } from "./place-row";
import { ReportRow } from "./report-row";
import { RouteRow } from "./route-row";
import { QUEUE_LIMIT, type QueueSlug } from "./slugs";
import { TrafficRow } from "./traffic-row";
import { DeskContext, useDeskState } from "./use-decision";

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

/** How long a decided card takes to leave. */
const LEAVE_MS = 200;

type Row = { key: string; node: ReactNode };

type Moderation = ApiOutputs["moderation"]["queue"];
type RoutesData = ApiOutputs["routes"]["browse"];

/** The queues that also work as a map: pins for places, reports on the roads, trails. */
const MAPS = {
  places: {
    kind: "places",
    items: (data) => data.places.map(placeMapItem),
    legend: (data, copy) => copy.placesLegend(data.places),
  } satisfies QueueMapSpec<Moderation>,
  traffic: {
    kind: "traffic",
    items: (data) => data.traffic.map(trafficMapItem),
    legend: (data, copy) => copy.trafficLegend(data.traffic),
  } satisfies QueueMapSpec<Moderation>,
  routes: {
    kind: "routes",
    items: (data) => data.items.map(routeMapItem),
    legend: (_data, copy) => copy.routeLegend(),
  } satisfies QueueMapSpec<RoutesData>,
};
type Shown = Row & { leaving: boolean };
type Leaving = { row: Row; index: number };

/**
 * The moderation desk for one queue: a title and count, the municipality
 * filter, a refresh, and the items waiting for a decision.
 *
 * Every queue shares this frame and the decision controls; only the card in
 * the middle differs. Decisions are applied to the list before the server
 * answers (see `useDecision`); the filter lives in the URL and nothing here
 * navigates or scrolls.
 */
export function QueueDesk({ queue }: { queue: QueueSlug }) {
  // Keyed, so one queue never shows another's rows as a placeholder.
  return queue === "routes" ? (
    <RoutesDesk />
  ) : (
    <ModerationDesk key={queue} queue={queue} />
  );
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
      scope={`${queue}:${municipalityId ?? ""}`}
      query={query}
      map={queue === "places" || queue === "traffic" ? MAPS[queue] : undefined}
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
      scope={`routes:${municipalityId ?? ""}`}
      query={query}
      map={MAPS.routes}
      rows={(data) =>
        data.items.map((route) => ({
          key: route.id,
          node: <RouteRow route={route} />,
        }))
      }
    />
  );
}

/**
 * The rows to draw: the list's own, plus the ones that just left, kept for one
 * short animation. Rows only leave this way when the list itself changed (a
 * decision, or somebody else's), never when a filter swapped it wholesale.
 */
function useShownRows(
  rows: Row[],
  scope: string,
  placeholder: boolean,
  animate: boolean,
) {
  const signature = rows.map((row) => row.key).join("|");
  const [track, setTrack] = useState({
    scope,
    signature,
    rows,
    placeholder,
    leaving: [] as Leaving[],
  });

  if (
    track.signature !== signature ||
    track.scope !== scope ||
    track.placeholder !== placeholder
  ) {
    const keys = new Set(rows.map((row) => row.key));
    const steady =
      animate && track.scope === scope && !track.placeholder && !placeholder;
    setTrack({
      scope,
      signature,
      rows,
      placeholder,
      leaving: steady
        ? [
            ...track.leaving.filter(({ row }) => !keys.has(row.key)),
            ...track.rows.flatMap((row, index) =>
              keys.has(row.key) ? [] : [{ row, index }],
            ),
          ]
        : [],
    });
  }

  const shown: Shown[] = rows.map((row) => ({ ...row, leaving: false }));
  for (const { row, index } of [...track.leaving].sort(
    (a, b) => a.index - b.index,
  )) {
    shown.splice(Math.min(index, shown.length), 0, { ...row, leaving: true });
  }

  const finish = (key: string) =>
    setTrack((current) => ({
      ...current,
      leaving: current.leaving.filter(({ row }) => row.key !== key),
    }));

  return { shown, finish };
}

/** The list as it is, or the same list beside a map of its items. */
function ListOrMap<T>({
  map,
  data,
  children,
}: {
  map?: QueueMapSpec<T>;
  data: T | undefined;
  children: ReactNode;
}) {
  const copy = useMapCopy();
  const items = useMemo(
    () => (map && data !== undefined ? map.items(data) : []),
    [map, data],
  );
  if (!map || data === undefined) return <>{children}</>;
  return (
    <QueueMapLayout
      items={items}
      label={copy.queueAlt(map.kind, items.length)}
      legend={map.legend(data, copy)}
    >
      {children}
    </QueueMapLayout>
  );
}

function Desk<T>({
  slug,
  scope,
  query,
  rows,
  map,
}: {
  slug: QueueSlug;
  scope: string;
  query: UseQueryResult<T, Error>;
  rows: (data: T) => Row[];
  /** Present for the queues that can also be worked on a map. */
  map?: QueueMapSpec<T>;
}) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const region = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const focused = useRef<{ key: string; index: number } | null>(null);
  const forget = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const desk = useDeskState();
  const [view, setView] = useQueueView();
  const [refreshing, setRefreshing] = useState(false);
  const [position, setPosition] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const items = query.data ? rows(query.data) : [];
  const count = query.data ? items.length : undefined;
  const { shown, finish } = useShownRows(
    items,
    scope,
    query.isPlaceholderData,
    !reduceMotion,
  );

  // Leaving cards fold away; a card that came back (a refused decision) is
  // restored; every card can be focused by the shortcuts; and focus that was on
  // a card that is gone moves to its neighbour instead of falling to the page.
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) {
      // The last card left without a fold (reduced motion): the list is gone.
      if (focused.current && document.activeElement === document.body) {
        region.current?.focus({ preventScroll: true });
      }
      focused.current = null;
      return;
    }
    shown.forEach((entry, index) => {
      const card = element.children[index] as HTMLElement | undefined;
      if (!card) return;
      card.tabIndex = -1;
      if (entry.leaving && card.dataset.leaving === undefined) {
        card.dataset.leaving = "";
        card.inert = true;
        card.style.overflow = "hidden";
        const height = card.offsetHeight;
        card
          .animate(
            [
              { height: `${height}px`, opacity: 1 },
              {
                height: "0px",
                opacity: 0,
                paddingTop: "0px",
                paddingBottom: "0px",
                borderTopWidth: "0px",
              },
            ],
            { duration: LEAVE_MS, easing: "ease-out", fill: "forwards" },
          )
          .finished.then(() => finish(entry.key))
          .catch(() => {}); // expected: a card restored mid-fold cancels its animation
      } else if (!entry.leaving && card.dataset.leaving !== undefined) {
        for (const animation of card.getAnimations()) animation.cancel();
        delete card.dataset.leaving;
        card.inert = false;
        card.style.overflow = "";
      }
    });

    const last = focused.current;
    if (
      !last ||
      shown.some((entry) => entry.key === last.key && !entry.leaving)
    ) {
      return;
    }
    focused.current = null;
    const active = document.activeElement;
    const gone = shown.findIndex((entry) => entry.key === last.key);
    const lost =
      !active ||
      active === document.body ||
      (gone >= 0 && element.children[gone]?.contains(active));
    if (!lost) return;
    const after = shown.findIndex(
      (entry, index) => !entry.leaving && index >= last.index,
    );
    const next = after >= 0 ? after : shown.findLastIndex((e) => !e.leaving);
    const target = next >= 0 ? element.children[next] : region.current;
    (target as HTMLElement | null)?.focus({ preventScroll: true });
  });

  const rowsOf = () =>
    Array.from(list.current?.children ?? []).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.dataset.leaving === undefined,
    );

  // J and K walk the cards, P and R reach the decision of the focused one.
  // Never while typing, and never inside a dialog or an open menu.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable], [role=dialog], [role=alertdialog], [role=menu], [role=listbox], [role=combobox]",
        )
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      const cards = rowsOf();
      const current = cards.findIndex((card) =>
        card.contains(document.activeElement),
      );

      if (key === "j" || key === "k") {
        if (cards.length === 0) return;
        const next =
          key === "j"
            ? Math.min(cards.length - 1, current + 1)
            : current < 0
              ? cards.length - 1
              : Math.max(0, current - 1);
        event.preventDefault();
        cards[next]?.focus();
        setPosition(q("position", { index: next + 1, total: cards.length }));
        return;
      }

      if ((key === "p" || key === "r") && current >= 0) {
        const button = cards[current]?.querySelector<HTMLButtonElement>(
          `[data-decision="${key === "p" ? "primary" : "secondary"}"]:not(:disabled)`,
        );
        if (!button) return;
        event.preventDefault();
        // A choice that asks for words or a confirmation opens its form; one
        // that would act at once is only focused, so a keystroke never decides.
        if (button.dataset.form === "true") button.click();
        else button.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onListFocus = (event: FocusEvent<HTMLUListElement>) => {
    clearTimeout(forget.current);
    const card = (event.target as Element).closest("li");
    const index = card
      ? Array.prototype.indexOf.call(list.current?.children, card)
      : -1;
    const entry = shown[index];
    if (entry) focused.current = { key: entry.key, index };
  };

  const onListBlur = (event: FocusEvent<HTMLUListElement>) => {
    // Focus that went elsewhere on the page is the reviewer's choice; focus
    // that fell to nowhere (its card left) is looked after by the layout effect.
    if (event.relatedTarget) {
      focused.current = null;
    } else {
      clearTimeout(forget.current);
      forget.current = setTimeout(() => {
        focused.current = null;
      }, 300);
    }
  };

  useEffect(() => () => clearTimeout(forget.current), []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <DeskContext.Provider value={desk}>
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          id="queue-title"
          title={t(TITLE[slug])}
          description={q(`intro.${INTRO[slug]}`)}
        />

        <AdminToolbar
          actions={
            <>
              {count ? (
                <p className="text-sm text-muted-foreground tabular-nums">
                  {q("count", { count })}
                </p>
              ) : null}
              <Button
                variant="outline"
                size="icon"
                aria-label={t("refresh")}
                title={t("refresh")}
                onClick={refresh}
                disabled={refreshing}
                className="pointer-coarse:size-11"
              >
                <RefreshCw
                  aria-hidden
                  className={refreshing ? "motion-safe:animate-spin" : ""}
                />
              </Button>
            </>
          }
        >
          <MunicipalityFilter />
          {map ? <ViewToggle value={view} onChange={setView} /> : null}
        </AdminToolbar>

        <section
          ref={region}
          aria-labelledby="queue-title"
          aria-keyshortcuts="J K P R"
          tabIndex={-1}
          inert={query.isPlaceholderData}
          className={
            query.isPlaceholderData
              ? "flex flex-col gap-3 opacity-60 outline-none transition-opacity delay-150"
              : "flex flex-col gap-3 outline-none"
          }
        >
          <QueryState
            query={query}
            skeleton={
              <QueueSkeleton detail={slug === "photos" ? "image" : "facts"} />
            }
          >
            {() =>
              shown.length === 0 ? (
                <AdminEmpty
                  icon={CheckCircle2}
                  title={q("emptyTitle")}
                  description={q("emptyHint")}
                  className="animate-fade"
                />
              ) : (
                <ListOrMap
                  map={view === "map" ? map : undefined}
                  data={query.data}
                >
                  <AdminTableCard>
                    <ul
                      ref={list}
                      className="divide-y [&>li:focus-visible]:ring-2 [&>li:focus-visible]:ring-ring/50 [&>li:focus-visible]:outline-none [&>li:focus-visible]:ring-inset"
                      onFocus={onListFocus}
                      onBlur={onListBlur}
                    >
                      {shown.map((row) => (
                        <Fragment key={row.key}>{row.node}</Fragment>
                      ))}
                    </ul>
                  </AdminTableCard>
                  {items.length >= QUEUE_LIMIT ? (
                    <p className="text-xs text-muted-foreground">
                      {q("mayBeMore", { count: QUEUE_LIMIT })}
                    </p>
                  ) : null}
                </ListOrMap>
              )
            }
          </QueryState>
        </section>

        <p role="status" className="sr-only">
          {position}
        </p>
      </div>
    </DeskContext.Provider>
  );
}
