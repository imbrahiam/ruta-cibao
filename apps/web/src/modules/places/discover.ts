import type { BrowsePlacesInput } from "@ruta/contracts";
import { appTargetHref } from "@ruta/shared/app-target";
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
import type { Viewer } from "@/modules/access/viewer";
import { notBlockedAuthor } from "@/modules/safety/blocks";
import { placeThumbnail, thumbnailSelection } from "./thumbnail";

export async function browsePlaces(viewer: Viewer, input: BrowsePlacesInput) {
  const where = and(
    eq(places.status, "published"),
    notBlockedAuthor(places.createdByUserId, viewer),
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
        ...thumbnailSelection,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
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
  return {
    items: await Promise.all(
      items.map(async ({ appThumbnailKey, googlePlaceId, ...item }) => ({
        ...item,
        ...(await placeThumbnail({
          id: item.id,
          appThumbnailKey,
          googlePlaceId,
        })),
      })),
    ),
    total: totals[0]?.value ?? 0,
  };
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
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          createdAt: places.createdAt,
        })
        .from(places)
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .where(eq(places.createdByUserId, userId))
        .orderBy(desc(places.createdAt))
        .limit(100),
      db
        .select({
          id: placeReports.id,
          name: places.name,
          slug: places.slug,
          status: placeReports.status,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          createdAt: placeReports.createdAt,
        })
        .from(placeReports)
        .innerJoin(places, eq(places.id, placeReports.placeId))
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .where(eq(placeReports.reporterUserId, userId))
        .orderBy(desc(placeReports.createdAt))
        .limit(100),
      db
        .select({
          id: placePhotos.id,
          name: places.name,
          slug: places.slug,
          status: placePhotos.status,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          createdAt: placePhotos.createdAt,
        })
        .from(placePhotos)
        .innerJoin(places, eq(places.id, placePhotos.placeId))
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .where(eq(placePhotos.uploadedByUserId, userId))
        .orderBy(desc(placePhotos.createdAt))
        .limit(100),
      db
        .select({
          id: trafficReports.id,
          name: categories.name,
          status: trafficReports.status,
          description: trafficReports.description,
          descriptionStatus: trafficReports.descriptionModerationStatus,
          note: trafficReports.reviewNote,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
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
          publication: consultations.publicationStatus,
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          createdAt: consultations.createdAt,
        })
        .from(consultations)
        .innerJoin(categories, eq(categories.id, consultations.categoryId))
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
          categoryIcon: categories.icon,
          categoryColor: categories.color,
          createdAt: businessClaims.createdAt,
        })
        .from(businessClaims)
        .innerJoin(places, eq(places.id, businessClaims.placeId))
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .where(eq(businessClaims.claimantUserId, userId))
        .orderBy(desc(businessClaims.createdAt))
        .limit(100),
    ]);

  const placeHref = (slug: string) =>
    appTargetHref({ kind: "place", ref: slug });

  return [
    ...submittedPlaces.map((item) => ({
      ...item,
      publication: null,
      kind: "place" as const,
      // An unpublished place has no page to open yet, so it gets no link
      // rather than one that leads to "ese lugar no existe".
      href: item.status === "published" ? placeHref(item.slug) : null,
    })),
    ...reports.map((item) => ({
      ...item,
      publication: null,
      kind: "report" as const,
      note: null,
      href: placeHref(item.slug),
    })),
    ...photos.map((item) => ({
      ...item,
      publication: null,
      kind: "photo" as const,
      note: null,
      href: placeHref(item.slug),
    })),
    ...traffic.map(({ description, descriptionStatus, ...item }) => ({
      ...item,
      // Only reports with free text have anything held back for review.
      publication: description ? descriptionStatus : null,
      kind: "traffic" as const,
      // Only a live report can be opened; a lapsed one is off the map, which is
      // the whole point of it lapsing.
      href:
        item.status === "active"
          ? appTargetHref({ kind: "traffic", ref: item.id })
          : null,
    })),
    ...cases.map((item) => ({
      ...item,
      kind: "consultation" as const,
      note: null,
      href: appTargetHref({ kind: "consultation", ref: item.slug }),
    })),
    ...claims.map((item) => ({
      ...item,
      publication: null,
      kind: "claim" as const,
      href: placeHref(item.slug),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
