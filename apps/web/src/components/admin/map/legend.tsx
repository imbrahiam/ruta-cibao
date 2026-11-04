import { cn } from "@/lib/utils";

/**
 * What a mark on the map means, by shape as well as colour: a disc is a place
 * or a report (with its glyph), a solid line a reported stretch of road, a
 * trail is a line too, ending in a square.
 */
export type LegendEntry = {
  key: string;
  swatch: "disc" | "square" | "line";
  /** A CSS colour; omitted for ink (the foreground). */
  color?: string;
  label: string;
};

function Swatch({ swatch, color }: Pick<LegendEntry, "swatch" | "color">) {
  const style = { backgroundColor: color ?? "currentColor" };
  return (
    <span
      aria-hidden
      className={cn(
        "block shrink-0",
        swatch === "disc" && "size-3 rounded-full",
        swatch === "square" && "size-3 rounded-[3px]",
        swatch === "line" && "h-1 w-5 rounded-full",
      )}
      style={style}
    />
  );
}

export function MapLegend({
  entries,
  className,
}: {
  entries: LegendEntry[];
  className?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="flex items-center gap-1.5 text-foreground"
        >
          <Swatch swatch={entry.swatch} color={entry.color} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
