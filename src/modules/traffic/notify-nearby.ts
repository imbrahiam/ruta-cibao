import { and, eq, isNotNull, sql } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories, places, savedPlaces, trafficReports } from "@/db/schema";
import { notify } from "@/modules/notifications/notify";

/**
 * Telling the people a report is actually near.
 *
 * "Cerca de ti" is a promise, and the platform has no idea where anybody is —
 * deliberately. It never stores a location for a person, and asking every
 * phone to report one so it could send a notification would be a much larger
 * thing to build than the notification is worth.
 *
 * What it does hold is where people have shown an interest in being: the places
 * they kept, and the places they put on the map themselves. Somebody who saved
 * the clinic in Monción and submitted the colmado two streets over has told the
 * platform where their life happens, without ever being tracked. That is the
 * proximity this uses, and it is honest about its edges — a resident who has
 * saved nothing gets no notification, which is the right failure: silence
 * rather than a guess.
 *
 * The fan-out runs on the queue, not on the request. A landslide on a Sunday
 * afternoon can touch a few hundred people, and the person who reported it
 * should not be holding a spinner while their neighbours' phones buzz.
 */

/** Close enough that a driver would want to know before they set off. */
const NEARBY_METERS = 3_000;

/**
 * A ceiling, not a target.
 *
 * The province has three municipalities; a report that reaches this many people
 * is either the biggest thing that happened this month or a bug, and both are
 * better discovered than acted on.
 */
const MAX_RECIPIENTS = 200;

export async function notifyNearbyOfTraffic(reportId: string): Promise<number> {
  const [report] = await db
    .select({
      id: trafficReports.id,
      status: trafficReports.status,
      description: trafficReports.description,
      location: trafficReports.location,
      reportedByUserId: trafficReports.reportedByUserId,
      categoryName: categories.name,
    })
    .from(trafficReports)
    .innerJoin(categories, eq(categories.id, trafficReports.categoryId))
    .where(eq(trafficReports.id, reportId))
    .limit(1);

  // A report cleared or removed between the send and the run is not news.
  if (report?.status !== "active") return 0;

  const origin = sql`ST_SetSRID(ST_MakePoint(${report.location.x}, ${report.location.y}), 4326)::geography`;

  const isNear = sql`ST_DWithin(${places.location}::geography, ${origin}, ${NEARBY_METERS})`;

  // `union` rather than two queries: a person is one recipient however many
  // reasons they have to be one, and set union is where that de-duplication
  // belongs.
  const recipients = await union(
    db
      .select({ userId: savedPlaces.userId })
      .from(savedPlaces)
      .innerJoin(places, eq(places.id, savedPlaces.placeId))
      .where(and(eq(places.status, "published"), isNear)),

    db
      .select({ userId: sql<string>`${places.createdByUserId}` })
      .from(places)
      .where(
        and(
          eq(places.status, "published"),
          isNotNull(places.createdByUserId),
          isNear,
        ),
      ),
  ).limit(MAX_RECIPIENTS);

  const description = report.description?.trim()
    ? `${report.categoryName}: ${report.description.trim()}`
    : report.categoryName;

  let sent = 0;

  for (const row of recipients) {
    // Telling somebody about their own report is noise.
    if (!row.userId || row.userId === report.reportedByUserId) continue;

    await notify({
      userId: row.userId,
      messageKey: "notifications.trafficNearby",
      params: { description },
      href: `/mapa?reporte=${report.id}`,
      // No email. This is a thing that will be over in a few hours, and an
      // inbox is the wrong place for it.
      channels: { push: true, email: false },
    });

    sent += 1;
  }

  return sent;
}
