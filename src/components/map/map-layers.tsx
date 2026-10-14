"use client";

import {
  Map as MapIcon,
  Mountain,
  Satellite,
  Store,
  TrafficCone,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { OfflineBasemap } from "@/components/map/offline-basemap";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useMediaQuery } from "@/hooks/use-media-query";
import { publicEnv } from "@/lib/env.public";
import { TRAFFIC_COLORS, type TrafficTone } from "@/lib/map/traffic-colors";
import { VIEW_MODES, type ViewMode } from "@/lib/map/view-mode";
import { LayerRow } from "./layer-row";

/**
 * What the colours on a reported road mean, in words.
 *
 * Shown under the toggle rather than tucked behind a "?" — the contest asks for
 * a product usable without training, and a four-colour scale nobody explained
 * is a quiz. It also does the accessibility work: the colour is never the only
 * thing saying what a road is, here or on the map.
 */
const LEGEND: TrafficTone[] = ["blocking", "partial", "minor", "cleared"];

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
  communityControls,
  mode,
  traffic,
  alerts,
  googlePlaces,
  onModeChange,
  onTrafficChange,
  onAlertsChange,
  onGooglePlacesChange,
}: {
  communityControls?: React.ReactNode;
  mode: ViewMode;
  traffic: boolean;
  alerts: boolean;
  googlePlaces: boolean;
  onModeChange: (mode: ViewMode) => void;
  onTrafficChange: (enabled: boolean) => void;
  onAlertsChange: (enabled: boolean) => void;
  onGooglePlacesChange: (enabled: boolean) => void;
}) {
  const t = useTranslations("map.view");
  const trafficCopy = useTranslations("map.traffic");
  const alertsCopy = useTranslations("map.alerts");
  const placesCopy = useTranslations("map.googlePlaces");
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const googleRenderer = publicEnv.NEXT_PUBLIC_MAP_RENDERER === "google";
  const ActiveIcon = googleRenderer ? ICONS[mode] : MapIcon;

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      showSwipeHandle={!isDesktop}
      swipeDirection={isDesktop ? "right" : "down"}
    >
      <DrawerTrigger
        render={
          <button
            type="button"
            aria-label={t("label")}
            title={t("label")}
            // A circle over the map on a phone, where the map is the whole
            // application and a fixed card at the bottom reads as a strip of
            // chrome taken out of it. On a wider screen it grows the label
            // back, which is what makes it findable by someone who has never
            // used the app and has the room to be told. The leading edge
            // respects the landscape notch rather than kissing it.
            className="absolute bottom-6 left-[max(0.75rem,env(safe-area-inset-left))] z-20 flex size-12 items-center justify-center gap-2 rounded-full border border-black/5 bg-background shadow-[0_2px_10px_-2px_rgb(0_0_0/0.22)] transition-[background-color,transform] hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 md:left-4 md:h-11 md:w-auto md:rounded-full md:py-1 md:pr-4 md:pl-1"
          >
            <span className="flex size-9 items-center justify-center rounded-full md:bg-muted">
              <ActiveIcon className="size-5" aria-hidden />
            </span>
            <span className="hidden pr-1 font-medium text-sm md:inline">
              {t("short")}
            </span>
          </button>
        }
      />

      <DrawerContent className="data-[swipe-axis=y]:[--drawer-content-height:85dvh]">
        <DrawerHeader className="border-b text-left">
          <div className="flex items-center justify-between gap-4">
            <DrawerTitle className="text-lg">{t("title")}</DrawerTitle>
            <DrawerClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0 rounded-full"
                  aria-label={t("close")}
                />
              }
            >
              <X className="size-5" aria-hidden />
            </DrawerClose>
          </div>
          <DrawerDescription className="text-left">
            {t("description")}
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea
          className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]]:overscroll-contain"
          role="region"
          aria-label={t("options")}
        >
          <div className="pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {/* One of three, so a radio group: the circle says only one can be
            on, where a tick left that ambiguous. Tapping anywhere on the row
            picks it and closes the drawer. */}
            {googleRenderer && (
              <RadioGroup
                value={mode}
                onValueChange={(value) => {
                  onModeChange(value as ViewMode);
                  setOpen(false);
                }}
                aria-label={t("title")}
                className="flex flex-col gap-1 px-4"
              >
                {VIEW_MODES.map((option) => {
                  const Icon = ICONS[option];

                  return (
                    <label
                      key={option}
                      htmlFor={`view-mode-${option}`}
                      className="flex min-h-16 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary has-checked:bg-accent/60 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring"
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
                      <RadioGroupItem
                        value={option}
                        id={`view-mode-${option}`}
                      />
                    </label>
                  );
                })}
              </RadioGroup>
            )}

            {googleRenderer && <Separator className="my-3" />}
            {communityControls}

            <div className="flex flex-col gap-1 px-4 pb-8">
              {/* `whitespace-normal`: the Toggle base is `whitespace-nowrap`, which
              sent long hints off the right edge mid-word with no way to read
              them. These rows wrap like the radio rows above. */}
              {/* First in the list, because it is the layer this map is for. The
              one below it is Google's, and the two answer different halves of
              the same question. */}
              <LayerRow
                icon={TriangleAlert}
                title={alertsCopy("label")}
                hint={alertsCopy("hint")}
                checked={alerts}
                onCheckedChange={onAlertsChange}
              >
                <ul className="flex flex-col gap-1.5">
                  {LEGEND.map((tone) => (
                    <li
                      key={tone}
                      className="flex items-center gap-2.5 text-muted-foreground text-xs"
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-7 shrink-0 rounded-full"
                        style={{ backgroundColor: TRAFFIC_COLORS[tone] }}
                      />
                      {alertsCopy(`legend.${tone}`)}
                    </li>
                  ))}
                </ul>
              </LayerRow>

              {googleRenderer && (
                <>
                  <LayerRow
                    icon={TrafficCone}
                    title={trafficCopy("label")}
                    hint={trafficCopy("hint")}
                    checked={traffic}
                    onCheckedChange={onTrafficChange}
                  />
                  <LayerRow
                    icon={Store}
                    title={placesCopy("label")}
                    hint={placesCopy("hint")}
                    checked={googlePlaces}
                    onCheckedChange={onGooglePlacesChange}
                  />
                </>
              )}
              <OfflineBasemap />
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
}
