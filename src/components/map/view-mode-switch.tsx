"use client";

import {
  Check,
  Layers,
  Map as MapIcon,
  Mountain,
  Satellite,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { VIEW_MODES, type ViewMode } from "@/lib/map/view-mode";

const ICONS: Record<ViewMode, typeof MapIcon> = {
  mapa: MapIcon,
  relieve: Mountain,
  satelite: Satellite,
};

/**
 * Switching between street, terrain and satellite.
 *
 * A drawer rather than the stack of buttons Google puts in a corner: each
 * option gets a line saying what it is for, because "relieve" and "satélite"
 * are not self-explanatory to someone who has never had a reason to choose
 * between them, and the difference here is genuinely useful — one shows the
 * hills a route climbs, the other shows the land as it is.
 */
export function ViewModeSwitch({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const t = useTranslations("map.view");
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={t("label")}
            title={t("label")}
            className="size-12 shrink-0 rounded-full shadow-sm"
          >
            <Layers className="size-5" aria-hidden />
          </Button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
        </DrawerHeader>

        <ul className="flex flex-col gap-1 px-4 pb-8">
          {VIEW_MODES.map((option) => {
            const Icon = ICONS[option];
            const isOn = option === mode;

            return (
              <li key={option}>
                <button
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => {
                    onChange(option);
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
      </DrawerContent>
    </Drawer>
  );
}
