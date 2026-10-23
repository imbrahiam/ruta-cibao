import type { ContentTarget } from "@ruta/contracts";
import { eq, or } from "drizzle-orm";
import type { Db, DbTransaction } from "@/db";
import {
  categories,
  consultations,
  ecoRoutes,
  placePhotos,
  places,
  trafficReports,
} from "@/db/schema";

/**
 * What a reported or blocked reference points at, resolved on the server.
 *
 * The caller only ever names content by its canonical reference (a place or
 * consultation slug, otherwise an id). The municipality and the author come
 * from the row itself, never from anything the caller sends.
 */
export type ResolvedTarget = {
  kind: ContentTarget["kind"];
  /** The canonical reference: slug for places and consultations, else the id. */
  ref: string;
  municipalityId: string;
  /** Null for a seeded or institutional record: there is nobody to block. */
  authorUserId: string | null;
  /** A short label for the staff queue, never shown to the public. */
  title: string;
  /** Whether people other than the author and staff can currently see it. */
  publiclyVisible: boolean;
};

type Executor = Db | DbTransaction;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveContentTarget(
  executor: Executor,
  target: ContentTarget,
): Promise<ResolvedTarget | null> {
  const isId = UUID.test(target.ref);

  switch (target.kind) {
    case "place": {
      const [row] = await executor
        .select({
          id: places.id,
          slug: places.slug,
          name: places.name,
          status: places.status,
          municipalityId: places.municipalityId,
          authorUserId: places.createdByUserId,
        })
        .from(places)
        .where(
          isId
            ? or(eq(places.id, target.ref), eq(places.slug, target.ref))
            : eq(places.slug, target.ref),
        )
        .limit(1);
      if (!row) return null;
      return {
        kind: "place",
        ref: row.slug,
        municipalityId: row.municipalityId,
        authorUserId: row.authorUserId,
        title: row.name,
        publiclyVisible: row.status === "published",
      };
    }
    case "photo": {
      if (!isId) return null;
      const [row] = await executor
        .select({
          id: placePhotos.id,
          status: placePhotos.status,
          placeName: places.name,
          municipalityId: places.municipalityId,
          authorUserId: placePhotos.uploadedByUserId,
        })
        .from(placePhotos)
        .innerJoin(places, eq(places.id, placePhotos.placeId))
        .where(eq(placePhotos.id, target.ref))
        .limit(1);
      if (!row) return null;
      return {
        kind: "photo",
        ref: row.id,
        municipalityId: row.municipalityId,
        authorUserId: row.authorUserId,
        title: row.placeName,
        publiclyVisible: row.status === "published",
      };
    }
    case "route": {
      if (!isId) return null;
      const [row] = await executor
        .select({
          id: ecoRoutes.id,
          name: ecoRoutes.name,
          status: ecoRoutes.status,
          municipalityId: ecoRoutes.municipalityId,
          authorUserId: ecoRoutes.submittedByUserId,
        })
        .from(ecoRoutes)
        .where(eq(ecoRoutes.id, target.ref))
        .limit(1);
      if (!row) return null;
      return {
        kind: "route",
        ref: row.id,
        municipalityId: row.municipalityId,
        authorUserId: row.authorUserId,
        title: row.name,
        publiclyVisible: row.status === "published",
      };
    }
    case "traffic": {
      if (!isId) return null;
      const [row] = await executor
        .select({
          id: trafficReports.id,
          status: trafficReports.status,
          expiresAt: trafficReports.expiresAt,
          categoryName: categories.name,
          municipalityId: trafficReports.municipalityId,
          authorUserId: trafficReports.reportedByUserId,
        })
        .from(trafficReports)
        .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
        .where(eq(trafficReports.id, target.ref))
        .limit(1);
      if (!row) return null;
      return {
        kind: "traffic",
        ref: row.id,
        municipalityId: row.municipalityId,
        authorUserId: row.authorUserId,
        title: row.categoryName,
        publiclyVisible: row.status === "active" && row.expiresAt > new Date(),
      };
    }
    case "consultation": {
      const [row] = await executor
        .select({
          id: consultations.id,
          slug: consultations.slug,
          title: consultations.title,
          publicationStatus: consultations.publicationStatus,
          municipalityId: consultations.municipalityId,
          authorUserId: consultations.openedByUserId,
        })
        .from(consultations)
        .where(
          isId
            ? or(
                eq(consultations.id, target.ref),
                eq(consultations.slug, target.ref),
              )
            : eq(consultations.slug, target.ref),
        )
        .limit(1);
      if (!row) return null;
      return {
        kind: "consultation",
        ref: row.slug,
        municipalityId: row.municipalityId,
        authorUserId: row.authorUserId,
        title: row.title,
        publiclyVisible: row.publicationStatus === "published",
      };
    }
  }
}
