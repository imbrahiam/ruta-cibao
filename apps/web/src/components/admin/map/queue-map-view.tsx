import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { useAdminTheme } from "@/lib/web/admin-theme";
import { AdminMap } from "./admin-map";
import { ItemFrameProvider, itemDomId } from "./item-frame";
import { type LegendEntry, MapLegend } from "./legend";
import type { MapItem } from "./map-types";
import { ContextDot } from "./markers";
import { useContextPlaces } from "./use-context-places";
import type { MapCopy } from "./use-map-copy";

/**
 * What a desk needs to offer a map view of its queue: which kind of item it
 * holds, how to turn its data into map items (one per row, `id` = the row's
 * key) and the legend for what is drawn.
 */
export type QueueMapSpec<T> = {
  kind: "places" | "traffic" | "routes";
  items: (data: T) => MapItem[];
  legend: (data: T, copy: MapCopy) => LegendEntry[];
};

/**
 * The other way to work a queue: every pending item on one large map, with
 * the same rows beside it. A marker selects its row (highlighted and scrolled
 * into view) and a row selects its marker (the map moves to it), so a
 * reviewer can judge where something is and decide on it without leaving.
 *
 * The list is the desk's own, its rows folded into one column; nothing about
 * deciding changes. The map stays in view while the list scrolls.
 */
export function QueueMapLayout({
  items,
  label,
  legend,
  children,
}: {
  /** One per row, with the row's key as id. */
  items: MapItem[];
  label: string;
  legend: LegendEntry[];
  /** The desk's own list, untouched: its rows take their place beside the map. */
  children: ReactNode;
}) {
  const t = useTranslations("admin.queue.map");
  const scheme = useAdminTheme().theme;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const context = useContextPlaces(true);

  // A decided item leaves the list: its selection goes with it.
  const selected = items.some((item) => item.id === selectedId)
    ? selectedId
    : null;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    const row = document.getElementById(itemDomId(id));
    if (!row) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollIntoView({
      block: "nearest",
      behavior: calm ? "auto" : "smooth",
    });
  }, []);

  const frame = useMemo(
    () => ({ selectedId: selected, onSelect: select }),
    [selected, select],
  );

  return (
    <ItemFrameProvider value={frame}>
      {/* On a desk the map fills the queue's height beside a list that
          scrolls on its own; on a phone the map sticks above the cards. */}
      <div className="grid min-h-0 flex-1 items-start gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-stretch">
        <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-(--radius-card) bg-background pb-1 lg:static lg:min-h-0 lg:pb-(--desk-bleed)">
          <AdminMap
            interactive
            items={items}
            context={context}
            label={label}
            selectedId={selected}
            onSelect={select}
            className="h-56 sm:h-80 lg:h-auto lg:min-h-0 lg:flex-1"
          />
          <MapLegend entries={legend} />
          {context.length > 0 ? (
            // The same dot as on the map, named.
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ContextDot scheme={scheme} />
              {t("publishedPlaces")}
            </span>
          ) : null}
        </div>
        <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-full">
          {children}
        </div>
      </div>
    </ItemFrameProvider>
  );
}
