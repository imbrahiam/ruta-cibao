"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";

/**
 * Category filters, as a row of chips.
 *
 * Scrolls sideways rather than wrapping, so the row never pushes the map down
 * a line as the municipality adds categories. The scrollbar is hidden and the
 * edges fade, which is what tells someone there is more without adding a
 * control to press.
 *
 * An empty selection means everything: a filter that empties the map when you
 * deselect the last chip is a trap, so "Todo" is always one tap away and is
 * shown as selected when nothing else is.
 */
export function CategoryChips({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (categoryIds: string[]) => void;
}) {
  const t = useTranslations("map.filters");
  const { data: categories } = useQuery(orpc.places.categories.queryOptions());

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          size="sm"
          variant={selected.length === 0 ? "default" : "secondary"}
          aria-pressed={selected.length === 0}
          className="h-10 shrink-0 rounded-full px-4 shadow-sm"
          onClick={() => onChange([])}
        >
          {t("all")}
        </Button>

        {(categories ?? []).map((category) => {
          const isOn = selected.includes(category.id);

          return (
            <Button
              key={category.id}
              type="button"
              size="sm"
              variant={isOn ? "default" : "secondary"}
              aria-pressed={isOn}
              className="h-10 shrink-0 gap-2 rounded-full px-4 shadow-sm"
              onClick={() => toggle(category.id)}
            >
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              {category.name}
            </Button>
          );
        })}
      </div>

      {/* Tells the eye the row continues, without occupying a tap target. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/90 to-transparent" />
    </div>
  );
}
