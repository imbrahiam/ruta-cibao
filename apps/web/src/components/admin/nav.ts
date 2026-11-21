import type { ApiOutputs } from "@ruta/contracts";
import type { LucideIcon } from "lucide-react";
// Plain objects that name the work (a shop, a signpost, a car), drawn like
// the rest of the set; not dashboard-tool shapes (grids, gears, wrenches).
import {
  BadgeCheck,
  CarFront,
  ChartColumnBig,
  Images,
  Inbox,
  MessageCircleMore,
  MessageSquareWarning,
  Signpost,
  SquarePen,
  Store,
  Tags,
} from "lucide-react";
import type { ModelName } from "@/components/category/category-model";

/** The overview stands alone: a label over a single link is noise. */
/**
 * Grouped by what the work is about: the map (places, with what people add to
 * them nested under it, then routes and road reports), the community (cases
 * and reports about content), and the desk's own management, which keeps plain
 * line glyphs: it is the serious part.
 */
export const ADMIN_GROUPS: readonly {
  id: "workspace" | "map" | "community" | "management";
  label: string | null;
}[] = [
  { id: "workspace", label: null },
  { id: "map", label: "shell.groupMap" },
  { id: "community", label: "shell.groupCommunity" },
  { id: "management", label: "shell.groupManagement" },
];

export type AdminSection = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown instead of the glyph where an object reads better than a line. */
  model?: ModelName;
  group: (typeof ADMIN_GROUPS)[number]["id"];
  /** Listed under this section's `href`, on the menu's guide line. */
  parent?: string;
  /** A shorter name for the narrower nested row. */
  shortLabel?: string;
  countKey?: keyof ApiOutputs["moderation"]["counts"];
  adminOnly?: boolean;
  relatedPath?: string;
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    href: "/admin",
    label: "shell.overview",
    icon: Inbox,
    model: "chart",
    group: "workspace",
  },
  {
    href: "/admin/queue/places",
    label: "places",
    icon: Store,
    model: "places",
    group: "map",
    countKey: "places",
  },
  {
    href: "/admin/queue/claims",
    label: "claims",
    icon: BadgeCheck,
    model: "store",
    parent: "/admin/queue/places",
    shortLabel: "shell.claimsShort",
    group: "map",
    countKey: "claims",
  },
  {
    href: "/admin/queue/photos",
    label: "photos",
    icon: Images,
    model: "camera",
    parent: "/admin/queue/places",
    group: "map",
    countKey: "photos",
  },
  {
    href: "/admin/queue/reports",
    label: "reports",
    icon: SquarePen,
    model: "correction",
    parent: "/admin/queue/places",
    group: "map",
    countKey: "reports",
  },
  {
    href: "/admin/queue/routes",
    label: "routes",
    icon: Signpost,
    model: "adventure",
    group: "map",
  },
  {
    href: "/admin/queue/traffic",
    label: "traffic",
    icon: CarFront,
    model: "cone",
    group: "map",
    countKey: "traffic",
  },
  {
    href: "/admin/consultations",
    label: "consultations",
    icon: MessageCircleMore,
    model: "chat",
    group: "community",
    countKey: "consultations",
    relatedPath: "/admin/queue/consultations",
  },
  {
    href: "/admin/queue/content-reports",
    label: "safety",
    icon: MessageSquareWarning,
    model: "flag",
    group: "community",
    countKey: "contentReports",
  },
  {
    href: "/admin/reports",
    label: "weekly",
    icon: ChartColumnBig,
    group: "management",
  },
  {
    href: "/admin/categories",
    label: "categories",
    icon: Tags,
    group: "management",
    adminOnly: true,
  },
];

export function findAdminSection(pathname: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find(
    (section) =>
      pathname === section.href ||
      (section.href !== "/admin" && pathname.startsWith(`${section.href}/`)) ||
      pathname === section.relatedPath,
  );
}
