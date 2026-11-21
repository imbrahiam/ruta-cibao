"use client";

import type { ApiOutputs } from "@ruta/contracts";
import {
  keepPreviousData,
  type UseQueryResult,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { ListMore } from "../list-more";
import {
  moderationQueuePagesOptions,
  pendingRoutesOptions,
  QUEUE_POLL_MS,
} from "../list-queries";
import { placeMapItem, routeMapItem, trafficMapItem } from "../map/queue-items";
import { QueueMapLayout, type QueueMapSpec } from "../map/queue-map-view";
import { useMapCopy } from "../map/use-map-copy";
import { useQueueView, ViewToggle } from "../map/view-toggle";
import {
  MunicipalityFilter,
  useMunicipalityFilter,
} from "../municipality-filter";
import { AdminPageHeader, AdminTableCard, AdminToolbar } from "../page-frame";
import { QueryState } from "../query-state";
import { QueueSkeleton } from "../skeletons";
import { CaseRow } from "./case-row";
import { ClaimDetail, ClaimLine, ClaimRow } from "./claim-row";
import { ContentReportRow } from "./content-report-row";
import { PhotoRow } from "./photo-row";
import { PlaceRow } from "./place-row";
import { QueueEmpty } from "./queue-empty";
import { ReportRow } from "./report-row";
import { RouteRow } from "./route-row";
import { QUEUES, type QueueSlug } from "./slugs";
import { SplitContext } from "./split";
import { TrafficDetail, TrafficLine, TrafficRow } from "./traffic-row";
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

/**
 * One item of a queue. `node` is the full card. A queue that also gives
 * `compact` and `pane` is worked as a list beside the selected item on wide
 * screens (the compact line on the left, its pane on the right); phones keep
 * the full card.
 */
type Row = {
  key: string;
  node: ReactNode;
  compact?: ReactNode;
  pane?: ReactNode;
};

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
 * filter, and the items waiting for a decision. The list keeps itself current
 * (`QUEUE_POLL_MS`, and on returning to the tab); there is no refresh button.
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
  const pages = useInfiniteQuery({
    ...moderationQueuePagesOptions(queue, municipalityId),
    placeholderData: keepPreviousData,
    refetchInterval: QUEUE_POLL_MS,
  });
  // The pages read as one list: the desk, its map and its shortcuts never see
  // where one page ends. An item that slid across a page edge between two
  // reads appears once.
  const api = QUEUES[queue].api;
  const data = useMemo(() => {
    const loaded = pages.data?.pages;
    if (!loaded?.[0]) return undefined;
    const seen = new Set<string>();
    const items = loaded
      .flatMap((page) => page[api] as Array<{ id: string }>)
      .filter((item) => !seen.has(item.id) && Boolean(seen.add(item.id)));
    return {
      ...loaded[0],
      [api]: items,
      total: loaded.at(-1)?.total ?? 0,
    } as Moderation;
  }, [pages.data, api]);
  const query = { ...pages, data } as UseQueryResult<Moderation, Error>;

  return (
    <Desk
      slug={queue}
      scope={`${queue}:${municipalityId ?? ""}`}
      query={query}
      total={data?.total}
      more={{
        hasMore: pages.hasNextPage,
        loading: pages.isFetchingNextPage,
        load: () => pages.fetchNextPage(),
      }}
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
              compact: <ClaimLine claim={claim} />,
              pane: <ClaimDetail claim={claim} />,
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
              compact: <TrafficLine report={report} />,
              pane: <TrafficDetail report={report} />,
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
    refetchInterval: QUEUE_POLL_MS,
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
  total,
  more,
}: {
  slug: QueueSlug;
  scope: string;
  query: UseQueryResult<T, Error>;
  rows: (data: T) => Row[];
  /** Present for the queues that can also be worked on a map. */
  map?: QueueMapSpec<T>;
  /** The whole queue's size, when it is read a page at a time. */
  total?: number;
  /** The next page, for the queues read a page at a time. */
  more?: {
    hasMore: boolean;
    loading: boolean;
    load: () => Promise<{ isError: boolean; error: unknown }>;
  };
}) {
  const t = useTranslations("admin");
  const q = useTranslations("admin.queue");
  const region = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const focused = useRef<{ key: string; index: number } | null>(null);
  const forget = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const desk = useDeskState();
  const [view, setView] = useQueueView();
  const [position, setPosition] = useState("");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [wide, setWide] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const pane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const items = query.data ? rows(query.data) : [];
  const count = query.data ? (total ?? items.length) : undefined;
  const { shown, finish } = useShownRows(
    items,
    scope,
    query.isPlaceholderData,
    !reduceMotion,
  );

  // List beside the selected item: only on a wide screen, for a queue that
  // gives both a compact line and a pane. The selection survives decisions:
  // when the chosen item leaves, the one that took its place is shown.
  // Beside the queue map the list is a narrow column of cards linked to its
  // pins, so the map view never splits.
  const split =
    wide &&
    view !== "map" &&
    items.length > 0 &&
    items.every((row) => row.pane);
  const selectedIndex = (() => {
    const at = shown.findIndex((row) => row.key === chosen);
    if (at >= 0 && !shown[at]?.leaving) return at;
    const from = Math.max(at, 0);
    const next = shown.findIndex((row, index) => index >= from && !row.leaving);
    return next >= 0 ? next : shown.findLastIndex((row) => !row.leaving);
  })();
  const selected = selectedIndex >= 0 ? shown[selectedIndex] : undefined;
  const splitValue = useMemo(
    () => ({
      selected: selected?.key ?? null,
      select: (key: string) => setChosen(key),
    }),
    [selected?.key],
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

      if ((key === "p" || key === "r") && (current >= 0 || split)) {
        // Beside a list, the decision lives in the selected item's pane.
        const scope = split ? pane.current : cards[current];
        const button = scope?.querySelector<HTMLButtonElement>(
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
    if (entry) {
      focused.current = { key: entry.key, index };
      if (split && !entry.leaving) setChosen(entry.key);
    }
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

  return (
    <DeskContext.Provider value={desk}>
      <SplitContext.Provider value={splitValue}>
        <div className="flex flex-col gap-5">
          <AdminPageHeader
            id="queue-title"
            title={t(TITLE[slug])}
            description={q(`intro.${INTRO[slug]}`)}
          />

          {/* The filter, then the count right above the list it counts: one
            short row before the first card. */}
          <AdminToolbar>
            <MunicipalityFilter />
            {/* Nothing to list is nothing to map either: no switch then. */}
            {map && count ? (
              <ViewToggle value={view} onChange={setView} />
            ) : null}
            {/* What is being reviewed, counted in its own word, beside the
              filter that decides it. */}
            {count ? (
              <p className="ml-auto text-sm text-muted-foreground tabular-nums">
                {q(`counts.${slug}`, { count })}
              </p>
            ) : null}
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
              errorTitle={q(`loadFailed.${slug}`)}
              skeleton={
                <QueueSkeleton detail={slug === "photos" ? "image" : "facts"} />
              }
            >
              {() =>
                shown.length === 0 ? (
                  <QueueEmpty slug={slug} />
                ) : (
                  <ListOrMap
                    map={view === "map" ? map : undefined}
                    data={query.data}
                  >
                    <div
                      className={
                        split
                          ? "grid items-start gap-6 grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
                          : undefined
                      }
                    >
                      {/* No frame and no rules: each item is its own soft block. */}
                      <AdminTableCard className="overflow-visible rounded-none border-0 bg-transparent">
                        <ul
                          ref={list}
                          className={cn(
                            "flex flex-col [&>li:focus-visible]:ring-2 [&>li:focus-visible]:ring-ring/50 [&>li:focus-visible]:outline-none [&>li:focus-visible]:ring-inset",
                            split ? "gap-1" : "gap-3",
                          )}
                          onFocus={onListFocus}
                          onBlur={onListBlur}
                        >
                          {shown.map((row) => (
                            <Fragment key={row.key}>
                              {split ? row.compact : row.node}
                            </Fragment>
                          ))}
                        </ul>
                      </AdminTableCard>
                      {split && selected ? (
                        <div
                          ref={pane}
                          key={selected.key}
                          className="sticky top-6 min-w-0 animate-fade"
                        >
                          {selected.pane}
                        </div>
                      ) : null}
                    </div>
                    {more ? (
                      <ListMore
                        shown={items.length}
                        total={count ?? items.length}
                        hasMore={more.hasMore}
                        loading={more.loading}
                        onMore={more.load}
                      />
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
      </SplitContext.Provider>
    </DeskContext.Provider>
  );
}
