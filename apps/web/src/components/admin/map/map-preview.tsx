"use client";

import { Maximize2, X } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminMap } from "./admin-map";
import { useItemFrame } from "./item-frame";
import { type LegendEntry, MapLegend } from "./legend";
import { CoordinateLine, MapLinks } from "./map-links";
import type { LatLng, MapItem } from "./map-types";
import { useContextPlaces } from "./use-context-places";

/**
 * An item's place on the map, sized for a row: a 16:10 thumbnail that opens
 * the same map large for inspection, with what it shows said in words, the
 * coordinates to copy and links into other maps.
 */
export function MapPreview({
  item,
  label,
  title,
  legend,
  summary,
  anchor,
  anchorLabel,
  className,
}: {
  item: MapItem;
  /** The map's text alternative. */
  label: string;
  /** Names the large map's window. */
  title: string;
  legend: LegendEntry[];
  /** One more line for the large map, e.g. a route's distance. */
  summary?: string;
  /** The point to copy and to open elsewhere: the spot, or a route's start. */
  anchor: LatLng;
  /** Says which point `anchor` is when it is not the item's own spot. */
  anchorLabel?: string;
  className?: string;
}) {
  const t = useTranslations("admin.queue.map");
  const [open, setOpen] = useState(false);
  const items = useMemo(() => [item], [item]);
  // Beside the desk's big map the row needs no map of its own: the facts only.
  const beside = useItemFrame() !== null;

  if (beside) {
    return (
      <PointFacts legend={legend} anchor={anchor} anchorLabel={anchorLabel} />
    );
  }

  return (
    <div className={cn("flex w-full max-w-72 flex-col gap-2", className)}>
      <Dialog open={open} onOpenChange={setOpen}>
        <AdminMap
          items={items}
          label={label}
          className="aspect-[16/10] w-full"
          overlay={
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={t("expandLabel", { title })}
                className="group absolute inset-0 z-10 cursor-zoom-in outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset"
              >
                <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full border bg-card/95 px-2.5 py-1 text-xs font-medium shadow-(--shadow-elevated) group-hover:bg-card">
                  <Maximize2 aria-hidden className="size-3" />
                  {t("expand")}
                </span>
              </button>
            </DialogTrigger>
          }
        />
        <DialogContent
          data-fullscreen
          showCloseButton={false}
          className="fixed inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:inset-6 sm:h-auto sm:w-auto sm:max-w-none sm:rounded-(--radius-dialog) sm:border"
        >
          {open ? (
            <ExpandedMap
              item={item}
              label={label}
              title={title}
              legend={legend}
              summary={summary}
              anchor={anchor}
              anchorLabel={anchorLabel}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <PointFacts
        legend={legend}
        anchor={anchor}
        anchorLabel={anchorLabel}
        compact
      />
    </div>
  );
}

function ExpandedMap({
  item,
  label,
  title,
  legend,
  summary,
  anchor,
  anchorLabel,
}: {
  item: MapItem;
  label: string;
  title: string;
  legend: LegendEntry[];
  summary?: string;
  anchor: LatLng;
  anchorLabel?: string;
}) {
  const t = useTranslations("admin.queue.map");
  const context = useContextPlaces(true);
  const items = useMemo(() => [item], [item]);

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <DialogTitle className="truncate text-[15px] leading-snug font-medium">
            {t("dialogTitle", { title })}
          </DialogTitle>
          <DialogDescription className="sr-only">{label}</DialogDescription>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" aria-label={t("close")}>
            <X aria-hidden />
          </Button>
        </DialogClose>
      </header>
      <div className="min-h-0 flex-1 p-3">
        <AdminMap
          interactive
          items={items}
          context={context}
          label={label}
          className="size-full"
        />
      </div>
      <footer className="flex flex-col gap-2 border-t px-4 py-3">
        {summary ? <p className="text-sm font-medium">{summary}</p> : null}
        <PointFacts legend={legend} anchor={anchor} anchorLabel={anchorLabel} />
        {context.length > 0 ? (
          <p className="text-xs text-muted-foreground">{t("contextHint")}</p>
        ) : null}
      </footer>
    </>
  );
}

/** Legend, coordinates with a copy button, and links into other maps. */
function PointFacts({
  legend,
  anchor,
  anchorLabel,
  compact,
}: {
  legend: LegendEntry[];
  anchor: LatLng;
  anchorLabel?: string;
  compact?: boolean;
}): ReactNode {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <MapLegend entries={legend} />
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-0.5",
          compact && "text-xs",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {anchorLabel ? (
            <span className="text-muted-foreground">{anchorLabel}</span>
          ) : null}
          <CoordinateLine point={anchor} />
        </span>
        <MapLinks point={anchor} only={compact ? "google" : undefined} />
      </div>
    </div>
  );
}
