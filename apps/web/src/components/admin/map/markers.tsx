import { Flag, Play } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { categoryIcon } from "./category-glyph";
import { MAP_INK, type Scheme } from "./palette";

/*
 * Marker bodies, drawn as DOM over the map. They mirror the phone app's
 * (`features/map/markers.tsx`): a disc in the item's colour with its category
 * glyph and a white rim. Shape and glyph carry the meaning as well as colour:
 * a place or report is a disc with its glyph, a route starts at a disc and
 * ends at a square.
 */

const RIM = "#FFFFFF";

type Interaction = {
  /** Accessible name; markers of a static map are hidden from assistive tech. */
  label: string;
  selected: boolean;
  onSelect?: () => void;
};

/** One tap target: a visible shape plus a 44px hit area around it. */
function Mark({
  label,
  selected,
  onSelect,
  className,
  style,
  children,
}: Interaction & {
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const shared = cn(
    "relative grid place-items-center border-2 shadow-sm transition-[width,height] duration-150 motion-reduce:transition-none",
    selected && "ring-4 ring-foreground/25",
    className,
  );

  if (!onSelect) {
    return (
      <span aria-hidden className={shared} style={style}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onSelect}
      className={cn(
        shared,
        "cursor-pointer outline-offset-4 before:absolute before:-inset-2 before:content-['']",
      )}
      style={style}
    >
      {children}
    </button>
  );
}

/** A place or a traffic report: category glyph on a colour disc. */
export function GlyphMarker({
  icon,
  color,
  size,
  name,
  ...interaction
}: Interaction & {
  icon: string;
  color: string;
  size: number;
  /** Written under the disc: the item a reviewer is looking for, by name. */
  name?: string;
}) {
  const Glyph = categoryIcon(icon);
  const px = interaction.selected ? size + 6 : size;
  const mark = (
    <Mark
      {...interaction}
      className="rounded-full"
      style={{
        width: px,
        height: px,
        backgroundColor: color,
        borderColor: RIM,
      }}
    >
      <Glyph
        aria-hidden
        strokeWidth={2.4}
        style={{
          width: Math.round(px * 0.5),
          height: Math.round(px * 0.5),
          color: RIM,
        }}
      />
    </Mark>
  );
  if (!name) return mark;
  return (
    <span className="relative block">
      {mark}
      <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-(--shadow-elevated)">
        {name}
      </span>
    </span>
  );
}

/** A route's ends: a disc where it starts, a square where it ends. */
export function RouteEndMarker({
  end,
  scheme,
  ...interaction
}: Interaction & { end: "start" | "end"; scheme: Scheme }) {
  const ink = MAP_INK[scheme];
  const Glyph = end === "start" ? Play : Flag;
  return (
    <Mark
      {...interaction}
      className={end === "start" ? "rounded-full" : "rounded-[6px]"}
      style={{
        width: 26,
        height: 26,
        backgroundColor: ink.pin,
        borderColor: ink.background,
      }}
    >
      <Glyph
        aria-hidden
        fill="currentColor"
        strokeWidth={2}
        style={{ width: 12, height: 12, color: ink.onPin }}
      />
    </Mark>
  );
}

/** A published place, faint: orientation, never a thing to act on. */
export function ContextDot({ scheme }: { scheme: Scheme }) {
  const ink = MAP_INK[scheme];
  return (
    <span
      aria-hidden
      className="block size-2 rounded-full border opacity-50"
      style={{ backgroundColor: ink.pin, borderColor: ink.background }}
    />
  );
}
