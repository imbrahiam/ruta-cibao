import { cn } from "@/lib/utils";
import { categoryIcon } from "./category-glyph";
import { categoryModel, ModelIcon } from "./category-model";

/**
 * A category as the map draws it: its glyph on its colour. `tile` is the
 * larger rounded square that stands in for a missing photo in a list row;
 * there the category's 3D model, when it has one, takes the glyph's place.
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
  const model = tile ? categoryModel(icon) : null;
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
      {model ? (
        <ModelIcon name={model} size={36} />
      ) : (
        <Glyph
          strokeWidth={tile ? 1.8 : 2.4}
          className={tile ? "size-6" : "size-3 text-white"}
        />
      )}
    </span>
  );
}

/**
 * A category in a list of categories: its model where it has one, otherwise
 * its pin. The colour still shows on the map and in the form.
 */
export function CategoryLead({ icon, color }: { icon: string; color: string }) {
  const model = categoryModel(icon);
  return model ? (
    <ModelIcon name={model} size={28} className="-my-1" />
  ) : (
    <span className="flex size-7 items-center justify-center">
      <CategoryPin icon={icon} color={color} />
    </span>
  );
}
