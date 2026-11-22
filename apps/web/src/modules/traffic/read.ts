import type { ActiveTrafficInput } from "@ruta/contracts";
import { pathLength } from "@ruta/shared/road-geometry";
import { CLEARED_VISIBLE_HOURS } from "@ruta/shared/traffic";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  categories,
  memberProfiles,
  municipalities,
  trafficConfirmations,
  trafficReports,
  user,
} from "@/db/schema";
import { hashLookup } from "@/lib/crypto";
import { residentVerified } from "@/modules/access/resident";
import type { Viewer } from "@/modules/access/viewer";
import { notBlockedAuthor } from "@/modules/safety/blocks";

/**
 * What is on the road right now, inside the viewport.
 *
 * A bounding box and `ST_Intersects` rather than a municipality filter: the
 * reader's viewport crosses municipal borders constantly, and a report on the
 * far side of one is exactly the report they need before they drive into it.
 *
 * `expiresAt` is checked here as well as by the expiry job. The job runs every
 * ten minutes; the map must never show a report that lapsed nine minutes ago
 * just because nothing has swept yet.
 *
 * Recently cleared reports come back too, and they are the reason this is not
 * simply "active reports". A road that was flooded this morning and that
 * neighbours say is clear now is the single most useful thing this platform
 * knows about that road — a speed-based traffic layer cannot say it, and
 * somebody deciding whether to set off is asking exactly that. They come back
 * marked `cleared`, and the map draws them green with no marker: information,
 * not something to act on.
 */
/**
 * The people behind a report.
 *
 * A report is worth more when several neighbours stand behind it, and a reader
 * can only weigh that if the map shows how many — and who counts, since a
 * verified resident's word is worth double in the tally and should look
 * different here too.
 *
 * The reporter comes first because they are the one who put it on the map;
 * everyone who confirmed or contradicted it follows. One entry per person, so
 * somebody changing their vote does not appear twice.
 */
const MAX_VOICES = 8;

function voiceKey(reportId: string, userId: string): string {
  return hashLookup(`traffic-voice:${reportId}`, userId).slice(0, 12);
}

type Voice = {
  /**
   * A stable handle for this person *on this report*.
   *
   * Exists so the list has a React key that is not an array index. Derived
   * rather than the account id, because an id on a public endpoint lets anybody
   * join two reports together into who-reports-what; this one is namespaced per
   * report, so the same citizen produces two unrelated keys.
   */
  key: string;
  name: string | null;
  image: string | null;
  residentVerified: boolean;
};

export async function activeTrafficReports(
  db: Db,
  viewer: Viewer,
  input: ActiveTrafficInput | { id: string },
) {
  const viewerId = viewer.kind === "anonymous" ? null : viewer.userId;

  const rows = await db
    .select({
      id: trafficReports.id,
      description: trafficReports.description,
      descriptionModerationStatus: trafficReports.descriptionModerationStatus,
      location: trafficReports.location,
      path: trafficReports.path,
      createdAt: trafficReports.createdAt,
      expiresAt: trafficReports.expiresAt,
      reportedByUserId: trafficReports.reportedByUserId,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColor: categories.color,
      severity: categories.severity,
      status: trafficReports.status,
      resolvedAt: trafficReports.resolvedAt,
      municipalityId: municipalities.id,
      municipalityName: municipalities.name,
      reportedBy: memberProfiles.displayName,
      reporterImage: user.image,
      reporterResidentVerified: residentVerified,
      stillCount: sql<number>`(
        select count(*)::int from ${trafficConfirmations}
        where ${trafficConfirmations.reportId} = ${trafficReports.id}
          and ${trafficConfirmations.verdict} = 'still'
      )`,
      clearedCount: sql<number>`(
        select count(*)::int from ${trafficConfirmations}
        where ${trafficConfirmations.reportId} = ${trafficReports.id}
          and ${trafficConfirmations.verdict} = 'cleared'
      )`,
      myVerdict: viewerId
        ? sql<"still" | "cleared" | null>`(
            select ${trafficConfirmations.verdict} from ${trafficConfirmations}
            where ${trafficConfirmations.reportId} = ${trafficReports.id}
              and ${trafficConfirmations.userId} = ${viewerId}
            limit 1
          )`
        : sql<"still" | "cleared" | null>`null::traffic_verdict`,
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
        notBlockedAuthor(trafficReports.reportedByUserId, viewer),
        or(
          and(
            eq(trafficReports.status, "active"),
            sql`${trafficReports.expiresAt} > now()`,
          ),
          // Only cleared ones that drew a road: a cleared point is a puddle
          // somebody stopped caring about, and nothing on the map should
          // celebrate it.
          and(
            eq(trafficReports.status, "cleared"),
            isNotNull(trafficReports.path),
            sql`${trafficReports.resolvedAt} > now() - make_interval(hours => ${CLEARED_VISIBLE_HOURS})`,
          ),
        ),
        "id" in input
          ? and(
              eq(trafficReports.id, input.id),
              eq(trafficReports.status, "active"),
            )
          : // A street report is on screen when any of its stretch is, not
            // only the point the reporter tapped.
            sql`(ST_Intersects(${trafficReports.location}, ST_MakeEnvelope(${input.west}, ${input.south}, ${input.east}, ${input.north}, 4326)) or ST_Intersects(${trafficReports.path}, ST_MakeEnvelope(${input.west}, ${input.south}, ${input.east}, ${input.north}, 4326)))`,
      ),
    )
    // Newest first: the thing that just happened is the thing nobody knows yet.
    .orderBy(sql`${trafficReports.createdAt} desc`)
    .limit("id" in input ? 1 : input.limit);

  /**
   * Everyone who has spoken about the reports on screen, in one round trip.
   *
   * A query per report would be a hundred of them on a busy afternoon, and the
   * answer is the same shape for all of them.
   */
  const voices = new Map<string, Voice[]>();
  const reportIds = rows.map((row) => row.id);

  if (reportIds.length > 0) {
    const said = await db
      .select({
        reportId: trafficConfirmations.reportId,
        userId: trafficConfirmations.userId,
        name: memberProfiles.displayName,
        image: user.image,
        residentVerified,
      })
      .from(trafficConfirmations)
      .leftJoin(
        memberProfiles,
        eq(memberProfiles.userId, trafficConfirmations.userId),
      )
      .leftJoin(user, eq(user.id, trafficConfirmations.userId))
      .where(inArray(trafficConfirmations.reportId, reportIds));

    for (const row of rows) {
      const seen = new Set<string>();
      const list: Voice[] = [];

      if (row.reportedByUserId) {
        seen.add(row.reportedByUserId);
        list.push({
          key: voiceKey(row.id, row.reportedByUserId),
          name: row.reportedBy,
          image: row.reporterImage,
          residentVerified: row.reporterResidentVerified,
        });
      }

      for (const vote of said) {
        if (vote.reportId !== row.id || seen.has(vote.userId)) continue;
        seen.add(vote.userId);
        list.push({
          key: voiceKey(row.id, vote.userId),
          name: vote.name,
          image: vote.image,
          residentVerified: vote.residentVerified,
        });
      }

      voices.set(row.id, list.slice(0, MAX_VOICES));
    }
  }

  return rows.map((row) => {
    // Stored as PostGIS orders it — x is longitude — and handed out the way the
    // rest of the client speaks.
    const path =
      row.path && row.path.length > 1
        ? row.path.map((point) => ({ lng: point.x, lat: point.y }))
        : null;

    return {
      id: row.id,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryIcon: row.categoryIcon,
      categoryColor: row.categoryColor,
      // The free text reaches other people only once reviewed; its author
      // always sees their own, with the state it is in.
      description:
        row.descriptionModerationStatus === "published" ||
        (viewerId !== null && row.reportedByUserId === viewerId)
          ? row.description
          : null,
      descriptionModerationStatus: row.descriptionModerationStatus,
      lng: row.location.x,
      lat: row.location.y,
      path,
      lengthMeters: path ? Math.round(pathLength(path)) : null,
      // Narrowed by the WHERE above; carrying that into the type keeps the
      // contract honest without widening it to the states nothing returns.
      state:
        row.status === "cleared" ? ("cleared" as const) : ("active" as const),
      severity: row.severity,
      municipalityId: row.municipalityId,
      municipalityName: row.municipalityName,
      reportedBy: row.reportedBy,
      reporterResidentVerified: row.reporterResidentVerified,
      // The faces behind it, and the headcount they stand for.
      voices: voices.get(row.id) ?? [],
      voiceCount: (voices.get(row.id) ?? []).length,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      stillCount: row.stillCount,
      clearedCount: row.clearedCount,
      myVerdict: row.myVerdict,
      isMine: viewerId !== null && row.reportedByUserId === viewerId,
    };
  });
}
