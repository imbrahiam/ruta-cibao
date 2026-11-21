import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The little 3D models the apps draw for kinds of places, as pictures.
 *
 * They are rendered once from the iOS app's SceneKit models
 * (`apps/ios/Sources/Screens/Mapa/VehicleModels.swift`) into
 * `public/models/<name>.webp`, 256 px square on a clear background. Used
 * sparingly, where an object reads better than a line glyph.
 */
export type ModelName =
  | "adventure"
  | "bike"
  | "buildings"
  | "bus"
  | "camera"
  | "car"
  | "chart"
  | "chat"
  | "church"
  | "civic"
  | "coffee"
  | "cone"
  | "farm"
  | "flag"
  | "food"
  | "fuel"
  | "hiker"
  | "lodging"
  | "market"
  | "medical"
  | "park"
  | "pharmacy"
  | "places"
  | "repair"
  | "school"
  | "sports"
  | "store"
  | "swimming";

/**
 * A category icon's model, as the apps pick it (`PlaceModel(icon:)`). A water
 * drop keeps its glyph (drinking water, not a swimming spot), and so does a
 * route (streets and roads, not an eco trail).
 */
const CATEGORY_MODELS: Record<string, ModelName> = {
  waves: "swimming",
  cross: "medical",
  hospital: "medical",
  "graduation-cap": "school",
  landmark: "civic",
  trees: "park",
  bus: "bus",
  trophy: "sports",
  church: "church",
  wheat: "farm",
  "shopping-basket": "market",
  store: "store",
  utensils: "food",
  "bed-double": "lodging",
  bed: "lodging",
  pill: "pharmacy",
  fuel: "fuel",
  "building-2": "buildings",
  wrench: "repair",
  car: "car",
  coffee: "coffee",
  footprints: "hiker",
  bike: "bike",
  mountain: "adventure",
};

/** The model for a category icon, or `null` when it keeps its glyph. */
export function categoryModel(
  icon: string | null | undefined,
): ModelName | null {
  return (icon && CATEGORY_MODELS[icon]) || null;
}

/** A model, decorative: the label next to it says what it is. */
export function ModelIcon({
  name,
  size = 20,
  className,
}: {
  name: ModelName;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={`/models/${name}.webp`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      // Already small, square and compressed; resizing them again only blurs.
      unoptimized
      draggable={false}
      className={cn("shrink-0 object-contain select-none", className)}
      style={{ width: size, height: size }}
    />
  );
}
