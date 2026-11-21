import type { QueueInput } from "@ruta/contracts";
import { formatPhone } from "@ruta/shared/phone";
import { pathLength } from "@ruta/shared/road-geometry";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  businessClaims,
  categories,
  consultations,
  consultationVotes,
  contentReports,
  memberProfiles,
  municipalities,
  placePhotos,
  placeReports,
  places,
  trafficReports,
  user,
} from "@/db/schema";
import { imageUrl } from "@/lib/storage";
import type { ModeratorViewer } from "@/modules/access/permissions";
import { residentVerified } from "@/modules/access/resident";
import { photosFor } from "@/modules/consultations/read";
import { appThumbnailKey } from "@/modules/places/thumbnail";
import { resolveContentTarget } from "@/modules/safety/targets";

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

/** Every row also carries how many match in all, before limit and offset. */
const total = sql<number>`(count(*) over ())::int`;

/** One page of a queue and the size of the whole queue. */
export type QueuePage<T> = { items: T[]; total: number };

const EMPTY = { items: [], total: 0 } as const;

function page<R extends { total: number }, T>(
  rows: R[],
  items: T[],
): QueuePage<T> {
  return { items, total: rows[0]?.total ?? 0 };
}

export async function pendingPlaces(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return EMPTY;

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
      submitterResidentVerified: residentVerified,
      total,
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
    .orderBy(asc(places.createdAt), asc(places.id))
    .limit(input.limit)
    .offset(input.offset);

  return page(
    rows,
    rows.map((row) => ({
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
      // The optional in-person resident badge, shown as context only: the
      // moderator weighs it, the code does not.
      submitterResidentVerified: row.submitterResidentVerified,
    })),
  );
}

export async function pendingReports(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return EMPTY;

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
      reportedByImage: user.image,
      reporterResidentVerified: residentVerified,
      total,
    })
    .from(placeReports)
    .innerJoin(places, eq(places.id, placeReports.placeId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, placeReports.reporterUserId),
    )
    .leftJoin(user, eq(user.id, placeReports.reporterUserId))
    .where(
      and(
        eq(placeReports.status, "pending"),
        scope === "all" ? undefined : inArray(places.municipalityId, scope),
      ),
    )
    .orderBy(asc(placeReports.createdAt), asc(placeReports.id))
    .limit(input.limit)
    .offset(input.offset);

  return page(
    rows,
    await Promise.all(
      rows.map(async (row) => ({
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
        reportedByImage: row.reportedByImage
          ? await mediaUrl(row.reportedByImage, 96)
          : null,
        reporterResidentVerified: row.reporterResidentVerified,
      })),
    ),
  );
}

/** How much is waiting, for the badge on the rail. */
export async function queueCounts(viewer: ModeratorViewer) {
  const scope = viewer.scope;

  const [
    placeRows,
    reportRows,
    photoRows,
    claimRows,
    caseRows,
    trafficRows,
    contentReportRows,
  ] = await Promise.all([
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
          or(
            eq(consultations.publicationStatus, "pending"),
            and(
              eq(consultations.publicationStatus, "published"),
              inArray(consultations.status, ["open", "in_review"]),
            ),
          ),
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
    db
      .select({ id: contentReports.id })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.status, "open"),
          scope === "all"
            ? undefined
            : inArray(contentReports.municipalityId, scope),
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
    contentReports: contentReportRows.length,
  };
}

/**
 * Photographs waiting for a look.
 *
 * Every upload from a member lands here; only authorized staff publish their
 * own photos directly.
 * The URL is signed per request and expires, which is what keeps an unpublished
 * photo unreachable to anybody who is not looking at this screen.
 */
export async function pendingPhotos(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return EMPTY;

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
      total,
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
    .orderBy(asc(placePhotos.createdAt), asc(placePhotos.id))
    .limit(input.limit)
    .offset(input.offset);

  const items = await Promise.all(
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
  return page(rows, items);
}

/** A stored image as something a browser can load: full URLs pass through. */
function mediaUrl(value: string, size: number): Promise<string> {
  return /^https?:\/\//.test(value)
    ? Promise.resolve(value)
    : imageUrl(value, { width: size, height: size });
}

/**
 * Claims waiting for somebody to weigh the evidence.
 *
 * The claimant's in-person resident badge is shown for the same reason it is
 * on the place queue: context for the moderator, not a rule in the code.
 */
export async function pendingClaims(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return EMPTY;

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
      claimedByImage: user.image,
      placeImageKey: appThumbnailKey,
      claimantResidentVerified: residentVerified,
      total,
    })
    .from(businessClaims)
    .innerJoin(places, eq(places.id, businessClaims.placeId))
    .innerJoin(categories, eq(categories.id, places.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, businessClaims.claimantUserId),
    )
    .leftJoin(user, eq(user.id, businessClaims.claimantUserId))
    .where(
      and(
        eq(businessClaims.status, "pending"),
        scope === "all" ? undefined : inArray(places.municipalityId, scope),
      ),
    )
    .orderBy(asc(businessClaims.createdAt), asc(businessClaims.id))
    .limit(input.limit)
    .offset(input.offset);

  const items = await Promise.all(
    rows.map(async ({ placeImageKey, total: _total, ...row }) => ({
      ...row,
      claimedByImage: row.claimedByImage
        ? await mediaUrl(row.claimedByImage, 96)
        : null,
      placeImage: placeImageKey ? await mediaUrl(placeImageKey, 320) : null,
      contactPhone: row.contactPhone ? formatPhone(row.contactPhone) : null,
      whatsapp: row.whatsapp ? formatPhone(row.whatsapp) : null,
      createdAt: row.createdAt.toISOString(),
    })),
  );
  return page(rows, items);
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
  if (scope !== "all" && scope.length === 0) return EMPTY;

  const rows = await db
    .select({
      id: consultations.id,
      slug: consultations.slug,
      title: consultations.title,
      body: consultations.body,
      status: consultations.status,
      publicationStatus: consultations.publicationStatus,
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
      total,
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
        // Waiting for a publication decision, or published and waiting for
        // an answer. A hidden case is out of the queue.
        or(
          eq(consultations.publicationStatus, "pending"),
          and(
            eq(consultations.publicationStatus, "published"),
            inArray(consultations.status, ["open", "in_review"]),
          ),
        ),
        scope === "all"
          ? undefined
          : inArray(consultations.municipalityId, scope),
      ),
    )
    // Cases waiting to be published first, then oldest first.
    .orderBy(
      sql`(${consultations.publicationStatus} = 'pending') desc`,
      asc(consultations.createdAt),
      asc(consultations.id),
    )
    .limit(input.limit)
    .offset(input.offset);
  const photos = await photosFor(
    db,
    rows.map((row) => row.id),
  );

  return page(
    rows,
    rows.map(({ total: _total, ...row }) => ({
      ...row,
      photos: photos.get(row.id) ?? [],
      createdAt: row.createdAt.toISOString(),
    })),
  );
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
  if (scope !== "all" && scope.length === 0) return EMPTY;

  const rows = await db
    .select({
      id: trafficReports.id,
      description: trafficReports.description,
      descriptionModerationStatus: trafficReports.descriptionModerationStatus,
      location: trafficReports.location,
      path: trafficReports.path,
      createdAt: trafficReports.createdAt,
      expiresAt: trafficReports.expiresAt,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      severity: categories.severity,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      reportedBy: memberProfiles.displayName,
      reportedByImage: user.image,
      reporterResidentVerified: residentVerified,
      total,
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
    .leftJoin(user, eq(user.id, trafficReports.reportedByUserId))
    .where(
      and(
        eq(trafficReports.status, "active"),
        sql`${trafficReports.expiresAt} > now()`,
        scope === "all"
          ? undefined
          : inArray(trafficReports.municipalityId, scope),
      ),
    )
    // Free text waiting for review first, then newest.
    .orderBy(
      sql`(${trafficReports.descriptionModerationStatus} = 'pending' and ${trafficReports.description} is not null) desc`,
      desc(trafficReports.createdAt),
      asc(trafficReports.id),
    )
    .limit(input.limit)
    .offset(input.offset);

  const items = await Promise.all(
    rows.map(async (row) => {
      // Stored as PostGIS orders it (x is longitude); handed out as the client
      // speaks it. Same shape as the public traffic read.
      const path =
        row.path && row.path.length > 1
          ? row.path.map((point) => ({ lng: point.x, lat: point.y }))
          : null;
      return {
        id: row.id,
        description: row.description,
        descriptionModerationStatus: row.descriptionModerationStatus,
        lng: row.location.x,
        lat: row.location.y,
        path,
        lengthMeters: path ? Math.round(pathLength(path)) : null,
        severity: row.severity,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        categoryName: row.categoryName,
        categoryIcon: row.categoryIcon,
        categoryColor: row.categoryColor,
        municipalityId: row.municipalityId,
        municipalityName: row.municipalityName,
        reportedBy: row.reportedBy,
        reportedByImage: row.reportedByImage
          ? await mediaUrl(row.reportedByImage, 96)
          : null,
        reporterResidentVerified: row.reporterResidentVerified,
      };
    }),
  );
  return page(rows, items);
}

/**
 * Reports about other people's content, threats and private information first.
 *
 * Several reports about the same content collapse into one row with a count,
 * because the decision is about the content, not about each reporter.
 */
export async function pendingContentReports(
  viewer: ModeratorViewer,
  input: QueueInput,
) {
  const scope = scopedMunicipalities(viewer, input.municipalityId);
  if (scope !== "all" && scope.length === 0) return EMPTY;

  const priority = sql<number>`(case when ${contentReports.reason} in ('personal_information', 'unsafe') then 0 else 1 end)`;
  const rows = await db
    .select({
      id: contentReports.id,
      kind: contentReports.subjectKind,
      ref: contentReports.subjectRef,
      reason: contentReports.reason,
      details: contentReports.details,
      createdAt: contentReports.createdAt,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      reportedBy: memberProfiles.displayName,
      openReportCount: sql<number>`(
        select count(*)::int from ${contentReports} as sibling
        where sibling.subject_kind = ${contentReports.subjectKind}
          and sibling.subject_ref = ${contentReports.subjectRef}
          and sibling.status = 'open'
      )`,
      total,
    })
    .from(contentReports)
    .innerJoin(
      municipalities,
      eq(municipalities.id, contentReports.municipalityId),
    )
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, contentReports.reporterUserId),
    )
    .where(
      and(
        eq(contentReports.status, "open"),
        scope === "all"
          ? undefined
          : inArray(contentReports.municipalityId, scope),
        // One row per piece of content: the report that sorts first stands for
        // the others about the same thing (they are counted). Done here rather
        // than after the read, so pages and the total count content, not reports.
        sql`not exists (
          select 1 from ${contentReports} as earlier
          where earlier.subject_kind = ${contentReports.subjectKind}
            and earlier.subject_ref = ${contentReports.subjectRef}
            and earlier.status = 'open'
            and (
              (case when earlier.reason in ('personal_information', 'unsafe') then 0 else 1 end),
              earlier.created_at,
              earlier.id
            ) < (${priority}, ${contentReports.createdAt}, ${contentReports.id})
        )`,
      ),
    )
    .orderBy(priority, asc(contentReports.createdAt), asc(contentReports.id))
    .limit(input.limit)
    .offset(input.offset);

  const items = await Promise.all(
    rows.map(async (row) => {
      const subject = await resolveContentTarget(db, {
        kind: row.kind,
        ref: row.ref,
      });
      return {
        id: row.id,
        subject: { kind: row.kind, ref: row.ref },
        subjectTitle: subject?.title ?? null,
        subjectVisible: subject?.publiclyVisible ?? false,
        reason: row.reason,
        priority:
          row.reason === "personal_information" || row.reason === "unsafe",
        details: row.details,
        createdAt: row.createdAt.toISOString(),
        municipalityId: row.municipalityId,
        municipalityName: row.municipalityName,
        reportedBy: row.reportedBy,
        openReportCount: row.openReportCount,
      };
    }),
  );
  return page(rows, items);
}
