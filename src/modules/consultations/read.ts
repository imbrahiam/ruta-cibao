import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  categories,
  consultationResponses,
  consultations,
  consultationVotes,
  memberProfiles,
  municipalities,
} from "@/db/schema";
import type { Viewer } from "@/modules/access/viewer";
import type { BrowseConsultationsInput } from "./contracts";
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

export async function browseConsultations(
  db: Db,
  viewer: Viewer,
  input: BrowseConsultationsInput,
) {
  const viewerId = viewer.kind === "anonymous" ? null : viewer.userId;

  // `mine` with no account is not an error, it is an empty list: the account
  // screen renders the same component whether or not the session resolved yet.
  if (input.mine && !viewerId) return { items: [], total: 0 };

  const filters = and(
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
        createdAt: consultations.createdAt,
        answeredAt: consultations.answeredAt,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        municipalityId: municipalities.id,
        municipalityName: municipalities.name,
        openedBy: memberProfiles.displayName,
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

  return {
    items: rows.map((row) => ({
      ...row,
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
    .where(eq(consultations.slug, slug))
    .limit(1);

  if (!row) throw new ConsultationError("not_found");

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

  return {
    ...row,
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
