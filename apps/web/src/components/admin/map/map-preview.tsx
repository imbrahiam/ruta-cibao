"use client";

import { Copy, ExternalLink, Maximize2, MoreHorizontal, X } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAdminTheme } from "@/lib/web/admin-theme";
import { useCopy } from "@/lib/web/use-copy";
import { useOutcome } from "../outcome";
import { AdminMap } from "./admin-map";
import { useItemFrame } from "./item-frame";
import { type LegendEntry, MapLegend } from "./legend";
import {
  CoordinateLine,
  formatCoordinates,
  MapLinks,
  openStreetMapUrl,
} from "./map-links";
import type { LatLng, MapItem } from "./map-types";
import { ContextDot } from "./markers";
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
  mapClassName,
  facts = true,
  subtitle,
}: {
  item: MapItem;
  /** The map's text alternative. */
  label: string;
  /** Names the large map's window. */
  title: string;
  /** One quiet line under the title there ("Sabaneta · Comedor"). */
  subtitle?: string;
  legend: LegendEntry[];
  /** One more line for the large map, e.g. a route's distance. */
  summary?: string;
  /** The point to copy and to open elsewhere: the spot, or a route's start. */
  anchor: LatLng;
  /** Says which point `anchor` is when it is not the item's own spot. */
  anchorLabel?: string;
  className?: string;
  /** The map's own box; 16:10 unless a layout needs it lower. */
  mapClassName?: string;
  /** Coordinates and copy under the small map; off where the map is only a
   * supporting preview (the expanded map still has them). */
  facts?: boolean;
}) {
  const t = useTranslations("admin.queue.map");
  const [open, setOpen] = useState(false);
  const items = useMemo(() => [item], [item]);
  // Beside the desk's big map the row needs no map of its own, nor a second
  // copy of the legend that already sits under that map: the point only.
  const beside = useItemFrame() !== null;

  if (beside) {
    return (
      <PointFacts
        legend={[]}
        anchor={anchor}
        anchorLabel={anchorLabel}
        compact
      />
    );
  }

  return (
    <div className={cn("flex w-full max-w-72 flex-col gap-2", className)}>
      <Dialog open={open} onOpenChange={setOpen}>
        <AdminMap
          items={items}
          label={label}
          className={cn("aspect-[16/10] w-full", mapClassName)}
          overlay={
            <DialogTrigger asChild>
              <button
                type="button"
                aria-label={t("expandLabel", { title })}
                className="group absolute inset-0 z-10 cursor-zoom-in outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset"
              >
                {/* Top corner: the bottom one is Google's attribution, which
                    the chip used to cover. */}
                <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border bg-card/95 px-2.5 py-1 text-xs font-medium shadow-(--shadow-elevated) group-hover:bg-card">
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
          // A phone gets the whole screen; a desk a deliberate window, centred,
          // with the full-screen control for more.
          className="fixed inset-0 flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(80dvh,760px)] sm:w-[min(92vw,1100px)] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-(--radius-dialog) sm:border"
        >
          {open ? (
            <ExpandedMap
              item={item}
              label={label}
              title={title}
              subtitle={subtitle}
              legend={legend}
              summary={summary}
              anchor={anchor}
              anchorLabel={anchorLabel}
            />
          ) : null}
        </DialogContent>
      </Dialog>
      {facts ? (
        <PointFacts
          legend={legend}
          anchor={anchor}
          anchorLabel={anchorLabel}
          compact
        />
      ) : null}
    </div>
  );
}

function ExpandedMap({
  item,
  label,
  title,
  subtitle,
  legend,
  summary,
  anchor,
}: {
  item: MapItem;
  label: string;
  title: string;
  subtitle?: string;
  legend: LegendEntry[];
  summary?: string;
  anchor: LatLng;
  anchorLabel?: string;
}) {
  const t = useTranslations("admin.queue.map");
  const q = useTranslations("admin.queue");
  const context = useContextPlaces(true);
  const items = useMemo(() => [item], [item]);
  const scheme = useAdminTheme().theme;
  const copy = useCopy();
  const announce = useOutcome();
  const contact = useTranslations("admin.contactActions");

  const copyCoordinates = async () => {
    if (await copy(formatCoordinates(anchor))) {
      announce(contact("copied", { what: t("theCoordinates") }));
    } else {
      announce(contact("copyFailed"), "error");
    }
  };

  return (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <DialogTitle className="truncate text-base leading-snug font-semibold">
            {title}
          </DialogTitle>
          {subtitle ? (
            <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
          <DialogDescription className="sr-only">{label}</DialogDescription>
        </div>
        <DialogClose asChild>
          <Button variant="ghost" size="icon" aria-label={t("close")}>
            <X aria-hidden />
          </Button>
        </DialogClose>
      </header>
      <div className="min-h-0 flex-1">
        <AdminMap
          interactive
          named
          items={items}
          context={context}
          label={label}
          className="size-full rounded-none border-0"
        />
      </div>
      <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-sm">
        {summary ? <p className="font-medium">{summary}</p> : null}
        <MapLegend entries={legend} />
        {context.length > 0 ? (
          // The same dot as on the map, named.
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <ContextDot scheme={scheme} />
            {t("publishedPlaces")}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1">
          <MapLinks point={anchor} only="google" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("more")}
                title={t("more")}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              <DropdownMenuItem onSelect={copyCoordinates}>
                <Copy aria-hidden />
                {t("copyCoordinates")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={openStreetMapUrl(anchor)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink aria-hidden />
                  {q("openInMaps")}
                  <span className="sr-only">{q("newTab")}</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
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
