"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { orpc } from "@/lib/orpc";

/**
 * Which kinds of place to show.
 *
 * A single button on the map that opens a drawer, rather than a row of chips
 * across the top: the taxonomy is edited by the municipality and will grow, and
 * a row that overflows into a horizontal scroll on a phone hides exactly the
 * categories nobody thought to put first.
 *
 * Selecting nothing means everything. A filter that empties the map when you
 * deselect the last option is a trap, and "todo" has to be reachable in one tap
 * from any state.
 */
export function CategoryFilter({
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

  const active = selected.length;

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <Button
            variant="secondary"
            // Floats over the map, thumb-height from the bottom edge, clear of
            // the drawer that opens when a place is tapped.
            className="absolute top-20 left-4 z-20 h-11 gap-2 rounded-full shadow-sm"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {active === 0 ? t("all") : t("selected", { count: active })}
          </Button>
        }
      />

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t("title")}</DrawerTitle>
          <DrawerDescription>{t("hint")}</DrawerDescription>
        </DrawerHeader>

        <ul className="flex flex-col gap-1 px-4 pb-8">
          {(categories ?? []).map((category) => {
            const isOn = selected.includes(category.id);

            return (
              <li key={category.id}>
                <button
                  type="button"
                  onClick={() => toggle(category.id)}
                  aria-pressed={isOn}
                  className="flex h-14 w-full items-center gap-3 rounded-lg px-3 text-left text-base transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    aria-hidden
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="flex-1">{category.name}</span>
                  {isOn && <Check className="size-5 shrink-0" aria-hidden />}
                </button>
              </li>
            );
          })}

          {active > 0 && (
            <li className="pt-2">
              <Button
                variant="ghost"
                className="h-11 w-full"
                onClick={() => onChange([])}
              >
                {t("clear")}
              </Button>
            </li>
          )}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
