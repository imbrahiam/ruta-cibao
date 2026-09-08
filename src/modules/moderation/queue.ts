import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businessClaims,
  categories,
  consultations,
  consultationVotes,
  memberProfiles,
  municipalities,
  placePhotos,
  placeReports,
  places,
  trafficReports,
} from "@/db/schema";
import { formatPhone } from "@/lib/phone";
import { imageUrl } from "@/lib/storage";
import type { ModeratorViewer } from "@/modules/access/permissions";
import type { QueueInput } from "./contracts";

/**
 * What is waiting for a decision.
 *
 * Oldest first, always. A queue sorted by anything else is a queue where the
 * awkward item is never reached, and the person who submitted it is left
 * assuming the platform swallowed their contribution.
 *
 * Scope is applied here rather than in the router: every read goes through this
 * function, so there is one place where "which municipalities may this person
 * see" is answered.
 */
function scopedMunicipalities(
  viewer: ModeratorViewer,
  requested: string | undefined,
): string[] | "all" {
  if (viewer.scope === "all") return requested ? [requested] : "all";
  if (!requested) return [...viewer.scope];
  // Asking for one outside the scope narrows to nothing rather than throwing:
  // this is a listing, and an empty list is the honest answer.
  return viewer.scope.includes(requested) ? [requested] : [];
}

export async function pendingPlaces(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return [];

  const rows = await db
    .select({
      id: places.id,
      slug: places.slug,
      name: places.name,
      description: places.description,
      address: places.address,
      location: places.location,
      locationSource: places.locationSource,
      createdAt: places.createdAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      submittedBy: memberProfiles.displayName,
      submitterTier: memberProfiles.tier,
    })
    .from(places)
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .leftJoin(memberProfiles, eq(memberProfiles.userId, places.createdByUserId))
    .where(
      and(
        eq(places.status, "pending"),
        scope === "all" ? undefined : inArray(places.municipalityId, scope),
      ),
    )
    .orderBy(asc(places.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    address: row.address,
    lng: row.location.x,
    lat: row.location.y,
    locationSource: row.locationSource,
    createdAt: row.createdAt.toISOString(),
    categoryName: row.categoryName,
    categoryColor: row.categoryColor,
    categoryIcon: row.categoryIcon,
    municipalityId: row.municipalityId,
    municipalityName: row.municipalityName,
    submittedBy: row.submittedBy,
    // Worth showing: a verified resident vouching for a place is a different
    // claim from an anonymous-ish visitor doing the same, and the moderator is
    // the person who should weigh that rather than the code.
    submitterTier: row.submitterTier,
  }));
}

export async function pendingReports(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return [];

  const rows = await db
    .select({
      id: placeReports.id,
      reason: placeReports.reason,
      details: placeReports.details,
      createdAt: placeReports.createdAt,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      reportedBy: memberProfiles.displayName,
    })
    .from(placeReports)
    .innerJoin(places, eq(places.id, placeReports.placeId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, placeReports.reporterUserId),
    )
    .where(
      and(
        eq(placeReports.status, "pending"),
        scope === "all" ? undefined : inArray(places.municipalityId, scope),
      ),
    )
    .orderBy(asc(placeReports.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
    placeId: row.placeId,
    placeName: row.placeName,
    placeSlug: row.placeSlug,
    municipalityId: row.municipalityId,
    municipalityName: row.municipalityName,
    reportedBy: row.reportedBy,
  }));
}

/** How much is waiting, for the badge on the rail. */
export async function queueCounts(viewer: ModeratorViewer) {
  const scope = viewer.scope;

  const [placeRows, reportRows, photoRows, claimRows, caseRows, trafficRows] =
    await Promise.all([
      db
        .select({ id: places.id })
        .from(places)
        .where(
          and(
            eq(places.status, "pending"),
            scope === "all" ? undefined : inArray(places.municipalityId, scope),
          ),
        ),
      db
        .select({ id: placeReports.id })
        .from(placeReports)
        .innerJoin(places, eq(places.id, placeReports.placeId))
        .where(
          and(
            eq(placeReports.status, "pending"),
            scope === "all" ? undefined : inArray(places.municipalityId, scope),
          ),
        ),
      db
        .select({ id: placePhotos.id })
        .from(placePhotos)
        .innerJoin(places, eq(places.id, placePhotos.placeId))
        .where(
          and(
            eq(placePhotos.status, "pending"),
            scope === "all" ? undefined : inArray(places.municipalityId, scope),
          ),
        ),
      db
        .select({ id: businessClaims.id })
        .from(businessClaims)
        .innerJoin(places, eq(places.id, businessClaims.placeId))
        .where(
          and(
            eq(businessClaims.status, "pending"),
            scope === "all" ? undefined : inArray(places.municipalityId, scope),
          ),
        ),
      db
        .select({ id: consultations.id })
        .from(consultations)
        .where(
          and(
            inArray(consultations.status, ["open", "in_review"]),
            scope === "all"
              ? undefined
              : inArray(consultations.municipalityId, scope),
          ),
        ),
      // Live rather than pending: nothing here is waiting for permission, and the
      // number a moderator needs is how much is currently on the map.
      db
        .select({ id: trafficReports.id })
        .from(trafficReports)
        .where(
          and(
            eq(trafficReports.status, "active"),
            sql`${trafficReports.expiresAt} > now()`,
            scope === "all"
              ? undefined
              : inArray(trafficReports.municipalityId, scope),
          ),
        ),
    ]);

  return {
    places: placeRows.length,
    reports: reportRows.length,
    photos: photoRows.length,
    claims: claimRows.length,
    consultations: caseRows.length,
    traffic: trafficRows.length,
  };
}

/**
 * Photographs waiting for a look.
 *
 * Only ones a visitor uploaded ever land here — a verified resident's photo
 * publishes on the spot — so the queue is short by design rather than by luck.
 * The URL is signed per request and expires, which is what keeps an unpublished
 * photo unreachable to anybody who is not looking at this screen.
 */
export async function pendingPhotos(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return [];

  const rows = await db
    .select({
      id: placePhotos.id,
      storageKey: placePhotos.storageKey,
      createdAt: placePhotos.createdAt,
      placeName: places.name,
      placeSlug: places.slug,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      uploadedBy: memberProfiles.displayName,
    })
    .from(placePhotos)
    .innerJoin(places, eq(places.id, placePhotos.placeId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, placePhotos.uploadedByUserId),
    )
    .where(
      and(
        eq(placePhotos.status, "pending"),
        scope === "all" ? undefined : inArray(places.municipalityId, scope),
      ),
    )
    .orderBy(asc(placePhotos.createdAt))
    .limit(input.limit);

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      url: await imageUrl(row.storageKey, {
        width: 900,
        height: 600,
        resize: "fit",
      }),
      createdAt: row.createdAt.toISOString(),
      placeName: row.placeName,
      placeSlug: row.placeSlug,
      municipalityId: row.municipalityId,
      municipalityName: row.municipalityName,
      uploadedBy: row.uploadedBy,
    })),
  );
}

/**
 * Claims waiting for somebody to weigh the evidence.
 *
 * The claimant's tier is shown for the same reason it is on the place queue: a
 * verified resident saying a colmado is theirs is a different claim from an
 * unverified account saying so, and the moderator is the one who should weigh
 * that rather than the code.
 */
export async function pendingClaims(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return [];

  const rows = await db
    .select({
      id: businessClaims.id,
      evidence: businessClaims.evidence,
      contactPhone: businessClaims.contactPhone,
      whatsapp: businessClaims.whatsapp,
      openingHours: businessClaims.openingHours,
      createdAt: businessClaims.createdAt,
      placeId: places.id,
      placeName: places.name,
      placeSlug: places.slug,
      categoryName: categories.name,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      claimedBy: memberProfiles.displayName,
      claimantTier: memberProfiles.tier,
    })
    .from(businessClaims)
    .innerJoin(places, eq(places.id, businessClaims.placeId))
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, businessClaims.claimantUserId),
    )
    .where(
      and(
        eq(businessClaims.status, "pending"),
        scope === "all" ? undefined : inArray(places.municipalityId, scope),
      ),
    )
    .orderBy(asc(businessClaims.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    ...row,
    contactPhone: row.contactPhone ? formatPhone(row.contactPhone) : null,
    whatsapp: row.whatsapp ? formatPhone(row.whatsapp) : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Cases the ayuntamiento has not answered yet.
 *
 * Oldest first, like every other queue here, and for the sharpest version of
 * the same reason: a case nobody has replied to is a resident being ignored,
 * and sorting by anything else decides which residents get ignored longest.
 */
export async function pendingConsultations(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return [];

  const rows = await db
    .select({
      id: consultations.id,
      slug: consultations.slug,
      title: consultations.title,
      body: consultations.body,
      status: consultations.status,
      createdAt: consultations.createdAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      openedBy: memberProfiles.displayName,
      supportCount: sql<number>`(
        select count(*)::int from ${consultationVotes}
        where ${consultationVotes.consultationId} = ${consultations.id}
      )`,
    })
    .from(consultations)
    .innerJoin(categories, eq(categories.id, consultations.categoryId))
    .innerJoin(
      municipalities,
      eq(municipalities.id, consultations.municipalityId),
    )
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, consultations.openedByUserId),
    )
    .where(
      and(
        inArray(consultations.status, ["open", "in_review"]),
        scope === "all"
          ? undefined
          : inArray(consultations.municipalityId, scope),
      ),
    )
    .orderBy(asc(consultations.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Traffic reports currently on the map.
 *
 * Not a queue in the same sense: nothing here is waiting for permission, it is
 * already published. This is the list a moderator scans for the one that should
 * not be — so it is newest first, which is where a bad report will be.
 */
export async function liveTrafficReports(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return [];

  const rows = await db
    .select({
      id: trafficReports.id,
      description: trafficReports.description,
      location: trafficReports.location,
      createdAt: trafficReports.createdAt,
      expiresAt: trafficReports.expiresAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      reportedBy: memberProfiles.displayName,
      reporterTier: memberProfiles.tier,
    })
    .from(trafficReports)
    .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
    .innerJoin(
      municipalities,
      eq(municipalities.id, trafficReports.municipalityId),
    )
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, trafficReports.reportedByUserId),
    )
    .where(
      and(
        eq(trafficReports.status, "active"),
        sql`${trafficReports.expiresAt} > now()`,
        scope === "all"
          ? undefined
          : inArray(trafficReports.municipalityId, scope),
      ),
    )
    .orderBy(desc(trafficReports.createdAt))
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    lng: row.location.x,
    lat: row.location.y,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    categoryName: row.categoryName,
    categoryIcon: row.categoryIcon,
    categoryColor: row.categoryColor,
    municipalityId: row.municipalityId,
    municipalityName: row.municipalityName,
    reportedBy: row.reportedBy,
    reporterTier: row.reporterTier,
  }));
}
