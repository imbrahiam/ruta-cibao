import type { ApiOutputs } from "@ruta/contracts";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Camera,
  FileText,
  Flag,
  FolderCog,
  LayoutDashboard,
  MapPin,
  MessagesSquare,
  Route,
  TriangleAlert,
  Wrench,
} from "lucide-react";

/** The overview stands alone: a label over a single link is noise. */
export const ADMIN_GROUPS: readonly {
  id: "workspace" | "moderation" | "management";
  label: string | null;
}[] = [
  { id: "workspace", label: null },
  { id: "moderation", label: "shell.groupModeration" },
  { id: "management", label: "shell.groupManagement" },
];

export type AdminSection = {
  href: string;
  label: string;
  icon: LucideIcon;
  group: (typeof ADMIN_GROUPS)[number]["id"];
  countKey?: keyof ApiOutputs["moderation"]["counts"];
  adminOnly?: boolean;
  relatedPath?: string;
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  {
    href: "/admin",
    label: "shell.overview",
    icon: LayoutDashboard,
    group: "workspace",
  },
  {
    href: "/admin/queue/places",
    label: "places",
    icon: MapPin,
    group: "moderation",
    countKey: "places",
  },
  {
    href: "/admin/queue/claims",
    label: "claims",
    icon: Building2,
    group: "moderation",
    countKey: "claims",
  },
  {
    href: "/admin/queue/photos",
    label: "photos",
    icon: Camera,
    group: "moderation",
    countKey: "photos",
  },
  {
    href: "/admin/queue/reports",
    label: "reports",
    icon: Wrench,
    group: "moderation",
    countKey: "reports",
  },
  {
    href: "/admin/queue/routes",
    label: "routes",
    icon: Route,
    group: "moderation",
  },
  {
    href: "/admin/queue/traffic",
    label: "traffic",
    icon: TriangleAlert,
    group: "moderation",
    countKey: "traffic",
  },
  {
    href: "/admin/queue/content-reports",
    label: "safety",
    icon: Flag,
    group: "moderation",
    countKey: "contentReports",
  },
  {
    href: "/admin/consultations",
    label: "consultations",
    icon: MessagesSquare,
    group: "management",
    countKey: "consultations",
    relatedPath: "/admin/queue/consultations",
  },
  {
    href: "/admin/reports",
    label: "weekly",
    icon: FileText,
    group: "management",
  },
  {
    href: "/admin/categories",
    label: "categories",
    icon: FolderCog,
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
