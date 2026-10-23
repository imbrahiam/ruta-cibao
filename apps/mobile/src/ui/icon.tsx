import {
  Bed,
  BedDouble,
  Bike,
  Building2,
  Bus,
  Car,
  Church,
  CloudRain,
  Coffee,
  Construction,
  Cross,
  Droplets,
  Footprints,
  Fuel,
  GraduationCap,
  Hospital,
  Landmark,
  Leaf,
  Lightbulb,
  type LucideIcon,
  MapPin,
  Mountain,
  OctagonX,
  Pill,
  Route,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Tent,
  Trash2,
  Trees,
  TriangleAlert,
  Utensils,
  Waves,
  Wheat,
  Wifi,
  Wrench,
} from "lucide-react-native";
import { type Palette, useTheme } from "./theme";

/**
 * Category icons are data: an official picks one in the admin panel and it is
 * stored by its Lucide name. This is the set the admin can choose from; an
 * unknown name falls back to a pin rather than to nothing.
 */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  bed: Bed,
  "bed-double": BedDouble,
  bike: Bike,
  "building-2": Building2,
  bus: Bus,
  car: Car,
  church: Church,
  "cloud-rain": CloudRain,
  coffee: Coffee,
  construction: Construction,
  cross: Cross,
  droplets: Droplets,
  fuel: Fuel,
  footprints: Footprints,
  "graduation-cap": GraduationCap,
  hospital: Hospital,
  landmark: Landmark,
  leaf: Leaf,
  lightbulb: Lightbulb,
  "map-pin": MapPin,
  mountain: Mountain,
  "octagon-x": OctagonX,
  pill: Pill,
  route: Route,
  "shopping-bag": ShoppingBag,
  "shopping-basket": ShoppingBasket,
  store: Store,
  tent: Tent,
  "trash-2": Trash2,
  trees: Trees,
  "triangle-alert": TriangleAlert,
  utensils: Utensils,
  waves: Waves,
  wheat: Wheat,
  wifi: Wifi,
  wrench: Wrench,
};

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || MapPin;
}

export type IconProps = {
  as: LucideIcon;
  size?: number;
  color?: keyof Palette | (string & {});
  strokeWidth?: number;
};

/** Decorative by default: the label next to it is what a screen reader hears. */
export function Icon({
  as: Glyph,
  size = 20,
  color = "text",
  strokeWidth = 2,
}: IconProps) {
  const { colors } = useTheme();
  const resolved = color in colors ? colors[color as keyof Palette] : color;
  return (
    <Glyph
      size={size}
      color={resolved}
      strokeWidth={strokeWidth}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
