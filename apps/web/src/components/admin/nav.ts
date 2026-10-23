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

/**
 * The staff sections, in the order a reviewer works through them. `label` is a
 * key in the `admin` catalogue namespace.
 */
export const ADMIN_SECTIONS: readonly {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only the province administrator may use it; moderators do not see it. */
  adminOnly?: boolean;
}[] = [
  { href: "/admin", label: "shell.overview", icon: LayoutDashboard },
  { href: "/admin/queue/places", label: "places", icon: MapPin },
  { href: "/admin/queue/claims", label: "claims", icon: Building2 },
  { href: "/admin/queue/photos", label: "photos", icon: Camera },
  { href: "/admin/queue/reports", label: "reports", icon: Wrench },
  { href: "/admin/queue/routes", label: "routes", icon: Route },
  { href: "/admin/queue/traffic", label: "traffic", icon: TriangleAlert },
  {
    href: "/admin/consultations",
    label: "consultations",
    icon: MessagesSquare,
  },
  { href: "/admin/queue/content-reports", label: "safety", icon: Flag },
  { href: "/admin/reports", label: "weekly", icon: FileText },
  {
    href: "/admin/categories",
    label: "categories",
    icon: FolderCog,
    adminOnly: true,
  },
];
