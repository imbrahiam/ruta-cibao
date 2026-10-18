import {
  BedDouble,
  Bike,
  Bus,
  CloudRain,
  Construction,
  Cross,
  Droplets,
  Footprints,
  GraduationCap,
  Landmark,
  Lightbulb,
  type LucideIcon,
  type LucideProps,
  MapPin,
  MessagesSquare,
  Mountain,
  OctagonX,
  Route,
  ShoppingBasket,
  Store,
  Trash2,
  Trees,
  TriangleAlert,
  Utensils,
  Waves,
  Wheat,
} from "lucide-react";

/**
 * Category icons are stored by name in the database, so an official can pick
 * one in the admin panel. This is the set the platform knows how to draw;
 * anything else falls back to a pin rather than to nothing.
 */
const ICONS: Record<string, LucideIcon> = {
  "bed-double": BedDouble,
  bike: Bike,
  bus: Bus,
  "cloud-rain": CloudRain,
  construction: Construction,
  cross: Cross,
  droplets: Droplets,
  footprints: Footprints,
  "graduation-cap": GraduationCap,
  landmark: Landmark,
  lightbulb: Lightbulb,
  "map-pin": MapPin,
  "messages-square": MessagesSquare,
  mountain: Mountain,
  "octagon-x": OctagonX,
  route: Route,
  "shopping-basket": ShoppingBasket,
  store: Store,
  "trash-2": Trash2,
  trees: Trees,
  "triangle-alert": TriangleAlert,
  utensils: Utensils,
  waves: Waves,
  wheat: Wheat,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || MapPin;
}

export function CategoryIcon({
  icon,
  ...props
}: { icon: string | null | undefined } & LucideProps) {
  const Icon = categoryIcon(icon);
  return <Icon strokeWidth={1.75} aria-hidden {...props} />;
}
