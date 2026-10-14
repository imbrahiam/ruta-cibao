"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
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
export function FilterChip({
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
        "flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 font-medium text-[15px] shadow-[0_1px_2px_rgb(0_0_0/0.06),0_4px_14px_-6px_rgb(0_0_0/0.16)] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "border-transparent bg-foreground text-background"
          : "border-black/[0.06] bg-background text-foreground hover:bg-secondary",
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
  const scrollRef = useRef<HTMLDivElement>(null);
  // The fading mask is applied imperatively against the element, so scroll
  // state never reaches React state — this whole lane is already imperative
  // from the wheel-forwarding below.
  const computeFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) {
      el.style.webkitMaskImage = "none";
      el.style.maskImage = "none";
      return;
    }
    const left = el.scrollLeft > 1 ? 32 : 0;
    const right = el.scrollLeft < max - 1 ? 32 : 0;
    const gradient = `linear-gradient(to right, transparent 0, #000 ${left * 4}px, #000 calc(100% - ${right * 4}px), transparent 100%)`;
    el.style.webkitMaskImage = gradient;
    el.style.maskImage = gradient;
  };
  const computeFadeRef = useRef(computeFade);
  computeFadeRef.current = computeFade;

  // The chips are what changes width, so the fade is recomputed when the list arrives.
  // biome-ignore lint/correctness/useExhaustiveDependencies: recompute on arrival
  useEffect(() => {
    computeFadeRef.current();
  }, [categories]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => computeFadeRef.current();
    const onResize = () => computeFadeRef.current();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // A desktop mouse wheel only reports vertical deltas, which never move a
    // sideways lane on their own. Translate them while the row has somewhere
    // to go; at either end the gesture falls through to the page as usual.
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      if (
        (event.deltaY < 0 && el.scrollLeft <= 0) ||
        (event.deltaY > 0 && el.scrollLeft >= max - 1)
      )
        return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((value) => value !== id)
        : [...selected, id],
    );
  }

  return (
    // -mr-3 pulls the lane out to the viewport's right edge — never past it,
    // since the overlay's own right padding is at least that wide — so the
    // end fade dissolves at the screen border instead of floating in a
    // gutter inside it.
    <div className="h-12 min-w-0 flex-1 -mr-3">
      <div
        ref={scrollRef}
        className="flex h-full items-center gap-2 overflow-x-auto scroll-px-3 pe-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <FilterChip active={selected.length === 0} onClick={() => onChange([])}>
          <LayoutGrid className="size-4" aria-hidden />
          {t("all")}
        </FilterChip>

        {(categories ?? []).map((category) => {
          const Icon = categoryIcon(category.icon);
          const active = selected.includes(category.id);

          return (
            <FilterChip
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
            </FilterChip>
          );
        })}
      </div>
    </div>
  );
}
