"use client";

import { TrafficCone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Turns the live traffic layer on and off.
 *
 * On by default, because seeing which roads are moving is the first thing
 * anyone opening a map of their town wants — but a toggle, because saturated
 * colour over every road competes with the markers when you are looking for a
 * place rather than a route.
 */
export function TrafficToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const t = useTranslations("map.traffic");

  return (
    <Button
      type="button"
      variant={enabled ? "default" : "secondary"}
      size="icon"
      aria-pressed={enabled}
      aria-label={enabled ? t("hide") : t("show")}
      title={enabled ? t("hide") : t("show")}
      className="size-12 shrink-0 rounded-full shadow-sm"
      onClick={() => onChange(!enabled)}
    >
      <TrafficCone className="size-5" aria-hidden />
    </Button>
  );
}
