"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/places/category-icon";
import { Chip } from "@/components/ui/tag";
import { cx } from "@/lib/cx";
import { orpc } from "@/lib/orpc";

/**
 * One row of category filters that scrolls sideways, with "Todo" first so a
 * filter can never leave the map empty without a way back. Several can be on
 * at once; the cluster counts follow.
 */
export function CategoryChips({
  selected,
  onChange,
  className,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const t = useTranslations("map");
  const { data = [] } = useQuery(orpc.places.categories.queryOptions());

  return (
    <div
      className={cx(
        "scrollbar-none flex gap-2 overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]",
        className,
      )}
    >
      <div className="flex gap-2 px-3 py-1 md:px-0">
        <Chip
          floating
          selected={selected.length === 0}
          onClick={() => onChange([])}
        >
          {t("all")}
        </Chip>
        {data.map((category) => {
          const on = selected.includes(category.id);
          return (
            <Chip
              key={category.id}
              selected={on}
              onClick={() =>
                onChange(
                  on
                    ? selected.filter((id) => id !== category.id)
                    : [...selected, category.id],
                )
              }
              floating
            >
              <span
                style={on ? undefined : { color: category.color }}
                className="flex"
              >
                <CategoryIcon icon={category.icon} />
              </span>
              {category.name}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
