import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { AdminMap } from "./admin-map";
import { ItemFrameProvider, itemDomId } from "./item-frame";
import { type LegendEntry, MapLegend } from "./legend";
import type { MapItem } from "./map-types";
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
    () => ({ stacked: true, selectedId: selected, onSelect: select }),
    [selected, select],
  );

  return (
    <ItemFrameProvider value={frame}>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-(--radius-card) bg-background pb-1 lg:top-4 lg:pb-0">
          <AdminMap
            interactive
            items={items}
            context={context}
            label={label}
            selectedId={selected}
            onSelect={select}
            className="h-56 sm:h-80 lg:h-[calc(100dvh-13rem)] lg:min-h-96"
          />
          <MapLegend entries={legend} />
          {context.length > 0 ? (
            <p className="text-xs text-muted-foreground">{t("contextHint")}</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-3">{children}</div>
      </div>
    </ItemFrameProvider>
  );
}
