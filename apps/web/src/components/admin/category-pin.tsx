import { categoryIcon } from "@/components/admin/map/category-glyph";
import { cn } from "@/lib/utils";

/**
 * A category as the map draws it: its glyph on its colour. `tile` is the
 * larger rounded square that stands in for a missing photo in a list row.
 */
export function CategoryPin({
  icon,
  color,
  tile = false,
  className,
}: {
  icon: string;
  color: string;
  tile?: boolean;
  className?: string;
}) {
  const Glyph = categoryIcon(icon);
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center",
        tile ? "size-14 rounded-lg" : "size-6 rounded-full",
        className,
      )}
      // A tile is a pale wash of the colour with the glyph in it; a pin is the
      // solid colour with a white glyph, as on the map.
      style={
        tile
          ? {
              backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
              color,
            }
          : { backgroundColor: color }
      }
    >
      <Glyph
        strokeWidth={tile ? 1.8 : 2.4}
        className={tile ? "size-6" : "size-3 text-white"}
      />
    </span>
  );
}
