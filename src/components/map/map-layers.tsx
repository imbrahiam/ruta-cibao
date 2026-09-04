"use client";

import {
  Check,
  Map as MapIcon,
  Mountain,
  Satellite,
  TrafficCone,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { VIEW_MODES, type ViewMode } from "@/lib/map/view-mode";

const ICONS: Record<ViewMode, typeof MapIcon> = {
  mapa: MapIcon,
  relieve: Mountain,
  satelite: Satellite,
};

/**
 * How the map is drawn, and what is drawn on it.
 *
 * One control in the bottom-left corner, the way every map application puts it,
 * because that is where people already look for it — and because the top of the
 * screen belongs to search and the bottom-right to zoom.
 *
 * View and traffic live together because they are the same question asked
 * twice: what do I want to see right now.
 */
export function MapLayers({
  mode,
  traffic,
  onModeChange,
  onTrafficChange,
}: {
  mode: ViewMode;
  traffic: boolean;
  onModeChange: (mode: ViewMode) => void;
  onTrafficChange: (enabled: boolean) => void;
}) {
  const t = useTranslations("map.view");
  const trafficCopy = useTranslations("map.traffic");
  const [open, setOpen] = useState(false);

  const ActiveIcon = ICONS[mode];

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <button
            type="button"
            aria-label={t("label")}
            // A card rather than a round button: it carries a label, which is
            // what makes it findable by someone who has never used the app.
            className="absolute bottom-6 left-4 z-20 flex items-center gap-2 rounded-xl border bg-background/95 py-2 pr-3 pl-2.5 shadow-md backdrop-blur-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
              <ActiveIcon className="size-5" aria-hidden />
            </span>
            <span className="pr-1 font-medium text-sm">{t("short")}</span>
          </button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
        </DrawerHeader>

        <ul className="flex flex-col gap-1 px-4">
          {VIEW_MODES.map((option) => {
            const Icon = ICONS[option];
            const isOn = option === mode;

            return (
              <li key={option}>
                <button
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => {
                    onModeChange(option);
                    setOpen(false);
                  }}
                  className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base">{t(option)}</span>
                    <span className="block text-muted-foreground text-xs leading-snug">
                      {t(`${option}Hint`)}
                    </span>
                  </span>
                  {isOn && <Check className="size-5 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>

        <Separator className="my-3" />

        <div className="px-4 pb-8">
          <button
            type="button"
            aria-pressed={traffic}
            onClick={() => onTrafficChange(!traffic)}
            className="flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <TrafficCone
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-base">{trafficCopy("label")}</span>
              <span className="block text-muted-foreground text-xs leading-snug">
                {trafficCopy("hint")}
              </span>
            </span>
            {traffic && <Check className="size-5 shrink-0" aria-hidden />}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
