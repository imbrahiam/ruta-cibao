import type { Metadata } from "next";
import { findAdminSection } from "@/components/admin/nav";
import { getT } from "@/lib/web/i18n";

const t = getT("admin");

/**
 * A staff page's tab title is its sidebar label ("Rutas | Ruta Cibao"), taken from the
 * same section registry the sidebar draws, so the two cannot drift apart. Detail pages
 * pass their list's path and read as that section.
 */
export function adminPageMetadata(pathname: string): Metadata {
  const section = findAdminSection(pathname);
  return {
    title: section ? t(section.label as Parameters<typeof t>[0]) : t("title"),
  };
}
