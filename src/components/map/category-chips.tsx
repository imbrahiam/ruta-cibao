"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/places/category-icon";
import { cx } from "@/lib/cx";
import { orpc } from "@/lib/orpc";

type Category = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
};

function useCategories() {
  const { data = [] } = useQuery(orpc.places.categories.queryOptions());
  return data as Category[];
}

/** "Todo" first, so a filter can never leave the map empty with no way back. */
function useAll() {
  const t = useTranslations("map");
  return [
    { id: "", name: t("all"), icon: null, color: "var(--accent)" },
    ...useCategories(),
  ];
}

/** Several can be on at once; "Todo" is the one that cannot be turned off. */
function toggle(category: { id: string }, active: boolean, selected: string[]) {
  if (!category.id) return [];
  return active
    ? selected.filter((id) => id !== category.id)
    : [...selected, category.id];
}

/**
 * The map's category row: Airbnb's shape — icon above the label on a phone,
 * beside it where there is width, and the active ones marked by an ink
 * underline. It puts every filter within one tap of the map instead of behind
 * a sheet, and it is one component at both sizes so a category added in the
 * admin panel appears in both without a change here.
 */
export function CategoryRail({
  selected,
  onChange,
  className,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const t = useTranslations("map.filters");
  const categories = useAll();

  return (
    <nav
      aria-label={t("categories")}
      className={cx(
        "glass flex h-14 items-stretch rounded-full md:h-12",
        className,
      )}
    >
      {/* The bar stays solid; only the items fade at the edge, so a phone
          shows there is more to scroll without showing a scrollbar. */}
      <div className="scrollbar-none flex h-full items-stretch overflow-x-auto rounded-full pr-7 pl-1.5 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] md:pr-1.5 md:[mask-image:none]">
        {categories.map((category) => {
          const active = category.id
            ? selected.includes(category.id)
            : selected.length === 0;
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(toggle(category, active, selected))}
              className={cx(
                "relative flex h-full shrink-0 flex-col items-center justify-center gap-1 rounded-full px-3.5 text-[12px] leading-none whitespace-nowrap transition-colors md:flex-row md:gap-1.5 md:px-3 md:text-[13px]",
                active ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
              )}
            >
              <span
                className={cx("flex", !active && "text-ink-3")}
                style={active ? { color: category.color } : undefined}
              >
                {category.id ? (
                  <CategoryIcon
                    icon={category.icon}
                    strokeWidth={1.6}
                    className="size-[18px] md:size-4"
                  />
                ) : (
                  <MapPin strokeWidth={1.6} className="size-[18px] md:size-4" />
                )}
              </span>
              <span>{category.name}</span>
              <span
                aria-hidden
                className={cx(
                  "absolute inset-x-3 bottom-1.5 h-[2.5px] rounded-full bg-ink transition-opacity duration-200 md:bottom-1",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * The same set as a grid of rows, for the layers sheet: two columns, the
 * icon in its disc, and a check on the ones that are on. A sheet can afford
 * the height; the map's edge cannot.
 */
export function CategoryGrid({
  selected,
  onChange,
  className,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const categories = useAll();

  return (
    <div className={cx("grid grid-cols-2 gap-2", className)}>
      {categories.map((category) => {
        const active = category.id
          ? selected.includes(category.id)
          : selected.length === 0;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(toggle(category, active, selected))}
            className={cx(
              "press flex min-h-14 items-center gap-2.5 rounded-card px-3 py-2 text-left text-[14px] transition-colors",
              active
                ? "bg-accent-soft font-medium text-accent ring-1 ring-inset ring-accent/30"
                : "bg-paper-2 text-ink-2 hover:bg-paper-3",
            )}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card"
              style={{ color: category.color }}
            >
              {category.id ? (
                <CategoryIcon icon={category.icon} className="size-4" />
              ) : (
                <MapPin strokeWidth={1.75} className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">{category.name}</span>
            {active ? <Check className="size-3.5 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  );
}
