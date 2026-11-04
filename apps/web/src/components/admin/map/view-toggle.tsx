"use client";

import { List, Map as MapIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { useUrlParam } from "../use-url-param";

export type QueueView = "list" | "map";

/** The desk's view, kept in the URL (`?view=map`); the list is the default. */
export function useQueueView(): readonly [
  QueueView,
  (next: QueueView) => void,
] {
  const [value, set] = useUrlParam("view", "list");
  return [value === "map" ? "map" : "list", set] as const;
}

/**
 * Lista | Mapa: two ways to work the same queue. Separate pills with the
 * selected one filled, like the desk's other single-choice toggles.
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: QueueView;
  onChange: (next: QueueView) => void;
}) {
  const t = useTranslations("admin.queue.map");
  const options = [
    { id: "list", label: t("viewList"), icon: List },
    { id: "map", label: t("viewMap"), icon: MapIcon },
  ] as const;

  return (
    // biome-ignore lint/a11y/useSemanticElements: a pill group, not a form fieldset
    <div role="group" aria-label={t("view")} className="flex gap-1">
      {options.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 pointer-coarse:h-11",
            value === id
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon aria-hidden className="size-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
