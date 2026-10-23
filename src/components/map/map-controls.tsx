"use client";

import { Popover } from "@base-ui/react/popover";
import {
  Info,
  Layers,
  LocateFixed,
  Minus,
  Navigation,
  Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { GeoState } from "@/hooks/use-geolocation";
import { cx } from "@/lib/cx";
import { useMapContext } from "./map-core";

const CONTROL =
  "press glass flex size-11 items-center justify-center text-ink hover:bg-card disabled:opacity-45 [&_svg]:size-[19px]";

/**
 * The map's own controls: one family of glass discs, stacked where a right
 * thumb rests. Zoom buttons only where there is no pinch (a pointer device);
 * on a phone they would be two more things to miss.
 *
 * The layers disc is desktop-only too: on a phone the same sheet opens from
 * the filter disc beside the search, where a thumb already is, and two doors
 * to one room is one too many.
 */
export function MapControls({
  geo,
  onLocate,
  onLayers,
  className,
}: {
  geo: GeoState;
  onLocate: () => void;
  onLayers: () => void;
  className?: string;
}) {
  const { map } = useMapContext();
  const t = useTranslations("map.controls");
  const tracking = geo.status === "tracking";

  return (
    <div
      className={cx(
        "pointer-events-auto flex flex-col items-end gap-2",
        className,
      )}
    >
      <button
        type="button"
        className={cx(CONTROL, "hidden rounded-full text-accent md:flex")}
        aria-label={t("layers")}
        onClick={onLayers}
      >
        <Layers strokeWidth={1.5} />
      </button>
      <div className="hidden flex-col overflow-hidden rounded-full pointer-fine:flex glass">
        <button
          type="button"
          aria-label={t("zoomIn")}
          onClick={() => map?.zoomIn({ duration: 260 })}
          className="press flex size-11 items-center justify-center text-ink hover:bg-card [&_svg]:size-[18px]"
        >
          <Plus strokeWidth={1.5} />
        </button>
        <span aria-hidden className="mx-3 h-px bg-line" />
        <button
          type="button"
          aria-label={t("zoomOut")}
          onClick={() => map?.zoomOut({ duration: 260 })}
          className="press flex size-11 items-center justify-center text-ink hover:bg-card [&_svg]:size-[18px]"
        >
          <Minus strokeWidth={1.5} />
        </button>
      </div>
      <button
        type="button"
        aria-label={tracking ? t("recenter") : t("locate")}
        aria-pressed={tracking}
        onClick={onLocate}
        className={cx(CONTROL, "rounded-full", tracking && "text-locate")}
      >
        {geo.status === "locating" ? (
          <LocateFixed
            strokeWidth={1.5}
            className="motion-safe:animate-[breathe_1.2s_ease-in-out_infinite]"
          />
        ) : tracking ? (
          <Navigation strokeWidth={1.5} className="fill-current" />
        ) : (
          <LocateFixed strokeWidth={1.5} />
        )}
      </button>
    </div>
  );
}

/** The credits OpenStreetMap's licence requires, one tap away. */
export function MapAttribution({ className }: { className?: string }) {
  const t = useTranslations("map.controls");
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("credits")}
        className={cx(
          "press glass pointer-events-auto flex size-8 items-center justify-center rounded-full text-ink-2 hover:text-ink pointer-coarse:size-9",
          className,
        )}
      >
        <Info strokeWidth={1.5} className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="top"
          align="start"
          sideOffset={8}
          className="z-50"
        >
          <Popover.Popup className="max-w-72 origin-[var(--transform-origin)] rounded-card bg-card p-4 text-ink shadow-lg outline-none transition-[transform,opacity] duration-200 data-[ending-style]:scale-[.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[.98] data-[starting-style]:opacity-0">
            <Popover.Title className="t-label text-ink-3">
              {t("creditsTitle")}
            </Popover.Title>
            <ul className="t-small mt-2 space-y-1.5 text-ink-2">
              <li>
                <a
                  className="text-accent underline-offset-2 hover:underline"
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener"
                >
                  © OpenStreetMap
                </a>{" "}
                {t("osm")}
              </li>
              <li>
                <a
                  className="text-accent underline-offset-2 hover:underline"
                  href="https://protomaps.com"
                  target="_blank"
                  rel="noopener"
                >
                  Protomaps
                </a>{" "}
                {t("protomaps")}
              </li>
              <li>{t("one")}</li>
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
