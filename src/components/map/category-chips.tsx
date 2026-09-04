"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { categoryIcon } from "@/lib/map/category-icons";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

/**
 * Category filters, as a row of chips.
 *
 * Icon and label, not a colour dot. A dot only means something to someone who
 * has already learned the legend, and there is no legend — whereas a fork says
 * "comedor" to a person who has never opened the app before. The colour is
 * still there, but on the map, where it ties a chip to the pins it controls.
 *
 * The row scrolls sideways rather than wrapping, so it never pushes the map
 * down a line as the municipality adds categories, and the right edge fades to
 * say there is more without spending a tap target on saying so.
 *
 * An empty selection means everything: a filter that empties the map when you
 * deselect the last chip is a trap, so "Todo" is always one tap away and reads
 * as selected when nothing else is.
 */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        // A white pill with a hairline and a soft shadow, the shape every map
        // application uses for this, sized for a thumb.
        "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 font-medium text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

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
        <Chip active={selected.length === 0} onClick={() => onChange([])}>
          <LayoutGrid className="size-4" aria-hidden />
          {t("all")}
        </Chip>

        {(categories ?? []).map((category) => {
          const Icon = categoryIcon(category.icon);
          const active = selected.includes(category.id);

          return (
            <Chip
              key={category.id}
              active={active}
              onClick={() => toggle(category.id)}
            >
              <Icon
                className="size-4"
                // The category's colour, but only when the chip is off: on a
                // dark selected chip it would be unreadable, and the selection
                // is already unmistakable from the fill.
                style={active ? undefined : { color: category.color }}
                aria-hidden
              />
              {category.name}
            </Chip>
          );
        })}
      </div>

      {/* Tells the eye the row continues, without occupying a tap target. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/80 to-transparent" />
    </div>
  );
}
