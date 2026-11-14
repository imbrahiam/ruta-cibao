import { parseAppTarget } from "@ruta/shared/app-target";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  consultations,
  ecoRoutes,
  places,
  trafficReports,
} from "@/db/schema";

export type SubjectCategory = { icon: string; color: string };

/**
 * The category of whatever each notification links to, keyed by href.
 *
 * Resolved when the list is read rather than stored on the row: a notice
 * written before this existed gets its pin too, and a category recoloured from
 * the admin panel shows its new colour everywhere at once. One query per kind,
 * however many notices there are.
 */
export async function subjectCategories(
  hrefs: (string | null)[],
): Promise<Map<string, SubjectCategory>> {
  const refs = {
    place: new Set<string>(),
    consultation: new Set<string>(),
    traffic: new Set<string>(),
    route: new Set<string>(),
  };
  for (const href of hrefs) {
    const target = href ? parseAppTarget(href) : null;
    if (target && target.kind !== "contributions" && target.kind in refs) {
      refs[target.kind as keyof typeof refs].add(target.ref);
    }
  }

  const pick = { icon: categories.icon, color: categories.color };
  const [placeRows, caseRows, trafficRows, routeRows] = await Promise.all([
    refs.place.size
      ? db
          .select({ ref: places.slug, ...pick })
          .from(places)
          .innerJoin(categories, eq(categories.id, places.categoryId))
          .where(inArray(places.slug, [...refs.place]))
      : [],
    refs.consultation.size
      ? db
          .select({ ref: consultations.slug, ...pick })
          .from(consultations)
          .innerJoin(categories, eq(categories.id, consultations.categoryId))
          .where(inArray(consultations.slug, [...refs.consultation]))
      : [],
    refs.traffic.size
      ? db
          .select({ ref: trafficReports.id, ...pick })
          .from(trafficReports)
          .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
          .where(inArray(trafficReports.id, [...refs.traffic]))
      : [],
    refs.route.size
      ? db
          .select({ ref: ecoRoutes.id, ...pick })
          .from(ecoRoutes)
          .innerJoin(categories, eq(categories.id, ecoRoutes.categoryId))
          .where(inArray(ecoRoutes.id, [...refs.route]))
      : [],
  ]);

  const found = new Map<string, SubjectCategory>();
  const add = (kind: keyof typeof refs, rows: typeof placeRows) => {
    for (const { ref, icon, color } of rows) {
      found.set(`${kind}:${ref}`, { icon, color });
    }
  };
  add("place", placeRows);
  add("consultation", caseRows);
  add("traffic", trafficRows);
  add("route", routeRows);

  const byHref = new Map<string, SubjectCategory>();
  for (const href of hrefs) {
    const target = href ? parseAppTarget(href) : null;
    if (!href || !target || target.kind === "contributions") continue;
    const category = found.get(`${target.kind}:${target.ref}`);
    if (category) byHref.set(href, category);
  }
  return byHref;
}
