import {
  BedDouble,
  Bike,
  Bus,
  CloudRain,
  Cross,
  Droplets,
  Footprints,
  GraduationCap,
  Landmark,
  Lightbulb,
  MapPin,
  OctagonX,
  Route,
  ShoppingBasket,
  Trash2,
  TreePine,
  TriangleAlert,
  Utensils,
  Waves,
  Wheat,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * The icon each category asks for, by name.
 *
 * Categories are rows the municipality edits, so the icon arrives as a string
 * and has to be resolved at runtime. An explicit map rather than a dynamic
 * import: the set is small, it keeps every icon in the bundle that is actually
 * reachable and none that is not, and an unknown name falls back to a pin
 * instead of rendering nothing.
 *
 * Adding a category with a new icon means adding a line here. That is the
 * trade for not shipping the whole icon library to a phone.
 */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  "bed-double": BedDouble,
  bike: Bike,
  bus: Bus,
  "cloud-rain": CloudRain,
  cross: Cross,
  droplets: Droplets,
  footprints: Footprints,
  "graduation-cap": GraduationCap,
  landmark: Landmark,
  lightbulb: Lightbulb,
  "map-pin": MapPin,
  "octagon-x": OctagonX,
  route: Route,
  "shopping-basket": ShoppingBasket,
  "trash-2": Trash2,
  trees: TreePine,
  "triangle-alert": TriangleAlert,
  utensils: Utensils,
  waves: Waves,
  wheat: Wheat,
};

export function categoryIcon(
  name: string | undefined,
): ComponentType<{ className?: string }> {
  return (name && ICONS[name]) || MapPin;
}
