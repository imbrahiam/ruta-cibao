import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businessClaims,
  categories,
  consultations,
  municipalities,
  placePhotos,
  placeReports,
  places,
  trafficReports,
} from "@/db/schema";
import type { BrowsePlacesInput } from "./contracts";

export async function browsePlaces(input: BrowsePlacesInput) {
  const where = and(
    eq(places.status, "published"),
    input.category ? eq(places.categoryId, input.category) : undefined,
    input.municipality
      ? eq(places.municipalityId, input.municipality)
      : undefined,
    input.query
      ? sql`unaccent(${places.name} || ' ' || coalesce(${places.description}, '')) ilike '%' || unaccent(${input.query.replace(/[\\%_]/g, "\\$&")}) || '%'`
      : undefined,
  );
  const [items, totals] = await Promise.all([
    db
      .select({
        id: places.id,
        slug: places.slug,
        name: places.name,
        description: places.description,
        imageUrl: places.imageUrl,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        municipalityName: municipalities.name,
      })
      .from(places)
      .innerJoin(categories, eq(categories.id, places.categoryId))
      .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
      .where(where)
      .orderBy(asc(places.name), asc(places.id))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ value: count() }).from(places).where(where),
  ]);
  return { items, total: totals[0]?.value ?? 0 };
}

/**
 * Everything one person has put into the platform, newest first.
 *
 * Six sources rather than three, because "mis aportes" has to mean all of them:
 * somebody told a road was blocked, or told their business claim was turned
 * down, has to be able to find the thing they are being told about. The
 * notification that carries the news links here.
 *
 * Each row carries its own `href` instead of the screen deriving one from the
 * kind. A place lives on the map, a case has its own page and a traffic report
 * is a parameter on the map — the service knows which, and a `switch` in the
 * component would be a second place for that to go stale.
 */
export async function listContributions(userId: string) {
  const [submittedPlaces, reports, photos, traffic, cases, claims] =
    await Promise.all([
      db
        .select({
          id: places.id,
          name: places.name,
          slug: places.slug,
          status: places.status,
          note: places.reviewNote,
          createdAt: places.createdAt,
        })
        .from(places)
        .where(eq(places.createdByUserId, userId))
        .orderBy(desc(places.createdAt))
        .limit(100),
      db
        .select({
          id: placeReports.id,
          name: places.name,
          slug: places.slug,
          status: placeReports.status,
          createdAt: placeReports.createdAt,
        })
        .from(placeReports)
        .innerJoin(places, eq(places.id, placeReports.placeId))
        .where(eq(placeReports.reporterUserId, userId))
        .orderBy(desc(placeReports.createdAt))
        .limit(100),
      db
        .select({
          id: placePhotos.id,
          name: places.name,
          slug: places.slug,
          status: placePhotos.status,
          createdAt: placePhotos.createdAt,
        })
        .from(placePhotos)
        .innerJoin(places, eq(places.id, placePhotos.placeId))
        .where(eq(placePhotos.uploadedByUserId, userId))
        .orderBy(desc(placePhotos.createdAt))
        .limit(100),
      db
        .select({
          id: trafficReports.id,
          name: categories.name,
          status: trafficReports.status,
          note: trafficReports.reviewNote,
          createdAt: trafficReports.createdAt,
        })
        .from(trafficReports)
        .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
        .where(eq(trafficReports.reportedByUserId, userId))
        .orderBy(desc(trafficReports.createdAt))
        .limit(100),
      db
        .select({
          id: consultations.id,
          name: consultations.title,
          slug: consultations.slug,
          status: consultations.status,
          createdAt: consultations.createdAt,
        })
        .from(consultations)
        .where(eq(consultations.openedByUserId, userId))
        .orderBy(desc(consultations.createdAt))
        .limit(100),
      db
        .select({
          id: businessClaims.id,
          name: places.name,
          slug: places.slug,
          status: businessClaims.status,
          note: businessClaims.reviewNote,
          createdAt: businessClaims.createdAt,
        })
        .from(businessClaims)
        .innerJoin(places, eq(places.id, businessClaims.placeId))
        .where(eq(businessClaims.claimantUserId, userId))
        .orderBy(desc(businessClaims.createdAt))
        .limit(100),
    ]);

  const placeHref = (slug: string) => `/mapa?lugar=${encodeURIComponent(slug)}`;

  return [
    ...submittedPlaces.map((item) => ({
      ...item,
      kind: "place" as const,
      // An unpublished place has no page to open yet, so it gets no link
      // rather than one that leads to "ese lugar no existe".
      href: item.status === "published" ? placeHref(item.slug) : null,
    })),
    ...reports.map((item) => ({
      ...item,
      kind: "report" as const,
      note: null,
      href: placeHref(item.slug),
    })),
    ...photos.map((item) => ({
      ...item,
      kind: "photo" as const,
      note: null,
      href: placeHref(item.slug),
    })),
    ...traffic.map((item) => ({
      ...item,
      kind: "traffic" as const,
      // Only a live report can be opened; a lapsed one is off the map, which is
      // the whole point of it lapsing.
      href:
        item.status === "active"
          ? `/mapa?reporte=${encodeURIComponent(item.id)}`
          : null,
    })),
    ...cases.map((item) => ({
      ...item,
      kind: "consultation" as const,
      note: null,
      href: `/consultas/${encodeURIComponent(item.slug)}`,
    })),
    ...claims.map((item) => ({
      ...item,
      kind: "claim" as const,
      href: placeHref(item.slug),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
