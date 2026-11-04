"use client";

import { MapPinOff } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MapsFailure } from "./google-maps";
import { CoordinateLine, MapLinks } from "./map-links";
import { itemAnchor, type LatLng, type MapItem } from "./map-types";

/**
 * What stands in for a map that cannot be drawn (no key, key blocked, network
 * down): the same facts in text. Every item's coordinates, a button to copy
 * them and links into other maps, so a reviewer is never stuck.
 */
export function MapFallback({
  items,
  reason,
  onRetry,
  compact,
  className,
}: {
  items: MapItem[];
  reason: MapsFailure;
  /** Offered when trying again can help (not when there is no key). */
  onRetry?: () => void;
  /** A thumbnail: the row shows the coordinates itself, so leave them out. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("admin.queue.map");
  const q = useTranslations("admin.queue");

  return (
    <div
      className={cn(
        "flex size-full flex-col gap-2 overflow-auto p-3 text-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <MapPinOff
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <p className="font-medium">{t("unavailable")}</p>
          <p className="text-xs text-muted-foreground">
            {t(reason === "no-key" ? "noKey" : "blocked")}
          </p>
          {onRetry && reason === "blocked" ? (
            <Button
              variant="link"
              onClick={onRetry}
              className="h-auto p-0 text-xs has-[>svg]:px-0 pointer-coarse:min-h-11"
            >
              {t("retry")}
            </Button>
          ) : null}
        </div>
      </div>
      {compact ? null : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const ends: { label: string | null; point: LatLng }[] =
              item.kind === "route"
                ? [
                    {
                      label: q("pathStart"),
                      point: item.path[0] ?? itemAnchor(item),
                    },
                    {
                      label: q("pathEnd"),
                      point:
                        item.path[item.path.length - 1] ?? itemAnchor(item),
                    },
                  ]
                : [{ label: null, point: itemAnchor(item) }];
            return (
              <li key={item.id} className="flex flex-col text-xs">
                {items.length > 1 ? (
                  <span className="font-medium">{item.label}</span>
                ) : null}
                {ends.map(({ label, point }) => (
                  <span
                    key={label ?? "point"}
                    className="flex flex-wrap items-center gap-x-2"
                  >
                    {label ? (
                      <span className="text-muted-foreground">{label}</span>
                    ) : null}
                    <CoordinateLine point={point} />
                  </span>
                ))}
                <MapLinks point={itemAnchor(item)} className="text-xs" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
