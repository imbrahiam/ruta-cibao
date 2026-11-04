import type { BrowseConsultationsInput } from "@ruta/contracts";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  categories,
  consultationPhotos,
  consultationResponses,
  consultations,
  consultationVotes,
  memberProfiles,
  municipalities,
  user,
  userBlocks,
} from "@/db/schema";
import { imageUrl } from "@/lib/storage";
import type { Viewer } from "@/modules/access/viewer";
import { notBlockedAuthor } from "@/modules/safety/blocks";
import { ConsultationError } from "./open-consultation";

/**
 * Reading the case list, and one case.
 *
 * Cases are public. A resident should be able to see that four neighbours have
 * already reported the same broken pipe before they file a fifth report about
 * it, and an ayuntamiento that answers in public is answering to more than the
 * one person who asked.
 *
 * What is not public is who opened it beyond a display name, and where they
 * live. The registry's name is what the platform shows; nothing here selects a
 * cédula, an account id or a municipality of residence.
 */

/** The counts every list row needs, as correlated subqueries. */
function supportCount() {
  return sql<number>`(
    select count(*)::int from ${consultationVotes}
    where ${consultationVotes.consultationId} = ${consultations.id}
  )`;
}

function responseCount() {
  return sql<number>`(
    select count(*)::int from ${consultationResponses}
    where ${consultationResponses.consultationId} = ${consultations.id}
  )`;
}

function supportedBy(userId: string | null) {
  if (!userId) return sql<boolean>`false`;
  return sql<boolean>`exists (
    select 1 from ${consultationVotes}
    where ${consultationVotes.consultationId} = ${consultations.id}
      and ${consultationVotes.userId} = ${userId}
  )`;
}

type Photo = { url: string; width: number; height: number; alt: string | null };

/** Photos for a page of cases, keyed by case id, in the author's order. */
async function photosFor(db: Db, ids: string[]) {
  const byCase = new Map<string, Photo[]>();
  if (ids.length === 0) return byCase;
  const rows = await db
    .select({
      consultationId: consultationPhotos.consultationId,
      storageKey: consultationPhotos.storageKey,
      width: consultationPhotos.width,
      height: consultationPhotos.height,
      alt: consultationPhotos.alt,
    })
    .from(consultationPhotos)
    .where(inArray(consultationPhotos.consultationId, ids))
    .orderBy(asc(consultationPhotos.position))
    .limit(ids.length * 4);
  for (const row of rows) {
    const list = byCase.get(row.consultationId) ?? [];
    if (list.length >= 4) continue;
    list.push({
      url: await imageUrl(row.storageKey, { width: 1080 }),
      width: row.width,
      height: row.height,
      alt: row.alt,
    });
    byCase.set(row.consultationId, list);
  }
  return byCase;
}

export async function browseConsultations(
  db: Db,
  viewer: Viewer,
  input: BrowseConsultationsInput,
) {
  const viewerId = viewer.kind === "anonymous" ? null : viewer.userId;

  // `mine` with no account is not an error, it is an empty list: the account
  // screen renders the same component whether or not the session resolved yet.
  if (input.mine && !viewerId) return { items: [], total: 0 };

  // Other people's cases are listed once published; a person's own cases
  // appear whatever their review state, so the author can follow them. A case
  // authored by somebody the viewer blocked is left out of the shared list.
  const visibility =
    input.mine && viewerId
      ? undefined
      : and(
          eq(consultations.publicationStatus, "published"),
          notBlockedAuthor(consultations.openedByUserId, viewer),
        );

  const filters = and(
    visibility,
    input.municipality
      ? eq(consultations.municipalityId, input.municipality)
      : undefined,
    input.category ? eq(consultations.categoryId, input.category) : undefined,
    input.status ? eq(consultations.status, input.status) : undefined,
    input.mine && viewerId
      ? eq(consultations.openedByUserId, viewerId)
      : undefined,
  );

  const [rows, [counted]] = await Promise.all([
    db
      .select({
        id: consultations.id,
        slug: consultations.slug,
        title: consultations.title,
        status: consultations.status,
        publicationStatus: consultations.publicationStatus,
        createdAt: consultations.createdAt,
        answeredAt: consultations.answeredAt,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        municipalityId: municipalities.id,
        municipalityName: municipalities.name,
        openedBy: memberProfiles.displayName,
        openedByImage: user.image,
        supportCount: supportCount(),
        responseCount: responseCount(),
        supported: supportedBy(viewerId),
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
      .leftJoin(user, eq(user.id, consultations.openedByUserId))
      .where(filters)
      // Newest first rather than most-supported: a queue sorted by popularity
      // is a queue where a case affecting one household is never reached, and
      // that household is exactly who a civic platform is for.
      .orderBy(desc(consultations.createdAt))
      .offset(input.offset)
      .limit(input.limit),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(consultations)
      .where(filters),
  ]);

  const photos = await photosFor(
    db,
    rows.map((row) => row.id),
  );

  return {
    items: rows.map((row) => ({
      ...row,
      photos: photos.get(row.id) ?? [],
      createdAt: row.createdAt.toISOString(),
      answeredAt: row.answeredAt?.toISOString() ?? null,
    })),
    total: counted?.total ?? 0,
  };
}

export async function consultationDetail(db: Db, viewer: Viewer, slug: string) {
  const viewerId = viewer.kind === "anonymous" ? null : viewer.userId;

  const [row] = await db
    .select({
      id: consultations.id,
      slug: consultations.slug,
      title: consultations.title,
      body: consultations.body,
      status: consultations.status,
      publicationStatus: consultations.publicationStatus,
      location: consultations.location,
      createdAt: consultations.createdAt,
      answeredAt: consultations.answeredAt,
      openedByUserId: consultations.openedByUserId,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      openedBy: memberProfiles.displayName,
      openedByImage: user.image,
      supportCount: supportCount(),
      responseCount: responseCount(),
      supported: supportedBy(viewerId),
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
    .leftJoin(user, eq(user.id, consultations.openedByUserId))
    .where(eq(consultations.slug, slug))
    .limit(1);

  if (!row) throw new ConsultationError("not_found");

  // Pending and hidden cases are for their author alone here; staff review
  // them through the moderation queue. What a blocked author wrote reads as
  // missing to the person who blocked them.
  const isAuthor = viewerId !== null && row.openedByUserId === viewerId;
  if (row.publicationStatus !== "published" && !isAuthor) {
    throw new ConsultationError("not_found");
  }
  if (row.publicationStatus === "published" && !isAuthor && viewerId) {
    const [blocked] = await db
      .select({ id: userBlocks.id })
      .from(userBlocks)
      .where(
        and(
          eq(userBlocks.blockingUserId, viewerId),
          eq(userBlocks.blockedUserId, row.openedByUserId ?? ""),
        ),
      )
      .limit(1);
    if (blocked) throw new ConsultationError("not_found");
  }

  const responses = await db
    .select({
      id: consultationResponses.id,
      body: consultationResponses.body,
      statusAfter: consultationResponses.statusAfter,
      createdAt: consultationResponses.createdAt,
      author: memberProfiles.displayName,
    })
    .from(consultationResponses)
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, consultationResponses.authorUserId),
    )
    .where(eq(consultationResponses.consultationId, row.id))
    // Oldest first: this is a conversation, and a conversation is read forwards.
    .orderBy(asc(consultationResponses.createdAt));

  const photos = await photosFor(db, [row.id]);

  return {
    ...row,
    photos: photos.get(row.id) ?? [],
    location: row.location
      ? { lng: row.location.x, lat: row.location.y }
      : null,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
    isMine: viewerId !== null && row.openedByUserId === viewerId,
    responses: responses.map((response) => ({
      ...response,
      createdAt: response.createdAt.toISOString(),
    })),
  };
}

/** How many cases are waiting on the ayuntamiento, for the desk badge. */
export async function openConsultationCount(
  db: Db,
  scope: readonly string[] | "all",
): Promise<number> {
  if (scope !== "all" && scope.length === 0) return 0;

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(consultations)
    .where(
      and(
        inArray(consultations.status, ["open", "in_review"]),
        scope === "all"
          ? undefined
          : inArray(consultations.municipalityId, [...scope]),
      ),
    );

  return counted?.total ?? 0;
}
