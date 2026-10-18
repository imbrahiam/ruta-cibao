import {
  CircleUserRound,
  Compass,
  Inbox,
  type LucideIcon,
  Map as MapIcon,
  MessagesSquare,
} from "lucide-react";

export type NavItem = {
  href: "/mapa" | "/explorar" | "/consultas" | "/aportes" | "/cuenta";
  key: "map" | "explore" | "consultations" | "contributions" | "account";
  icon: LucideIcon;
  /** Sub-pages that keep this tab lit. */
  also?: string[];
};

/**
 * The five places a phone can go in one tap. Reporting has its own button on
 * the map; routes and the passport live under Explorar and Cuenta.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/mapa", key: "map", icon: MapIcon },
  { href: "/explorar", key: "explore", icon: Compass, also: ["/rutas"] },
  { href: "/consultas", key: "consultations", icon: MessagesSquare },
  {
    href: "/aportes",
    key: "contributions",
    icon: Inbox,
    also: ["/pendientes"],
  },
  {
    href: "/cuenta",
    key: "account",
    icon: CircleUserRound,
    also: [
      "/pasaporte",
      "/verificar",
      "/entrar",
      "/bienvenida",
      "/moderacion",
      "/informes",
    ],
  },
];

export function isActive(item: NavItem, pathname: string): boolean {
  const paths = [item.href, ...(item.also ?? [])];
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}
