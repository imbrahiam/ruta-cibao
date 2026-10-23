import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { z } from "zod";
import { type Db, db } from "@/db";
import {
  categories,
  municipalities,
  passportStamps,
  places,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { hashLookup } from "@/lib/crypto";
import type { MemberViewer } from "@/modules/access/viewer";
import type { passportInput, StampInput } from "./contracts";
import { VISIT_RADIUS_METERS, visitProblem } from "./visit-policy";

function placeKey(userId: string, placeId: string) {
  return hashLookup(`passport-place:${userId}`, placeId);
}

export async function stampVisit(viewer: MemberViewer, input: StampInput) {
  return db.transaction(async (tx) => {
    const key = placeKey(viewer.userId, input.placeId);
    const [existing] = await tx
      .select()
      .from(passportStamps)
      .where(
        and(
          eq(passportStamps.userId, viewer.userId),
          eq(passportStamps.placeBlindIndex, key),
        ),
      )
      .limit(1);
    if (existing)
      return {
        id: existing.id,
        stampedAt: existing.stampedAt.toISOString(),
        created: false,
      };
    const problem = visitProblem(input);
    if (problem)
      throw new ORPCError("BAD_REQUEST", { data: { reason: problem } });
    const [place] = await tx
      .select({
        id: places.id,
        nearby: sql<boolean>`ST_DWithin(${places.location}::geography, ST_SetSRID(ST_MakePoint(${input.position.lng}, ${input.position.lat}), 4326)::geography, ${VISIT_RADIUS_METERS})`,
      })
      .from(places)
      .where(and(eq(places.id, input.placeId), eq(places.status, "published")))
      .limit(1)
      .for("share");
    if (!place) throw new ORPCError("NOT_FOUND");
    if (!place.nearby)
      throw new ORPCError("BAD_REQUEST", { data: { reason: "too_far" } });
    const [created] = await tx
      .insert(passportStamps)
      .values({
        userId: viewer.userId,
        placeBlindIndex: key,
        placeId: place.id,
      })
      .onConflictDoNothing()
      .returning();
    // A competing request may have committed while this one checked proximity.
    const [stamp] = created
      ? [created]
      : await tx
          .select()
          .from(passportStamps)
          .where(
            and(
              eq(passportStamps.userId, viewer.userId),
              eq(passportStamps.placeBlindIndex, key),
            ),
          )
          .limit(1);
    if (!stamp) throw new Error("Passport stamp insert returned no row");
    if (created)
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "passport.stamped",
          subjectType: "passport_stamp",
          subjectId: stamp.id,
        },
        tx,
      );
    // Coordinates never enter storage, the audit log or the idempotency ledger.
    return {
      id: stamp.id,
      stampedAt: stamp.stampedAt.toISOString(),
      created: Boolean(created),
    };
  });
}

export async function passportStatus(
  executor: Db,
  viewer: MemberViewer,
  placeId: string,
) {
  const [stamp] = await executor
    .select({ stampedAt: passportStamps.stampedAt })
    .from(passportStamps)
    .where(
      and(
        eq(passportStamps.userId, viewer.userId),
        eq(passportStamps.placeBlindIndex, placeKey(viewer.userId, placeId)),
      ),
    )
    .limit(1);
  return { stampedAt: stamp?.stampedAt.toISOString() ?? null };
}

export async function readPassport(
  executor: Db,
  viewer: MemberViewer,
  input: z.infer<typeof passportInput>,
) {
  const [stamps, [count]] = await Promise.all([
    executor
      .select()
      .from(passportStamps)
      .where(eq(passportStamps.userId, viewer.userId))
      .orderBy(desc(passportStamps.stampedAt), desc(passportStamps.id))
      .limit(input.limit)
      .offset(input.offset),
    executor
      .select({ total: sql<number>`count(*)::int` })
      .from(passportStamps)
      .where(eq(passportStamps.userId, viewer.userId)),
  ]);
  const destinations = stamps.length
    ? await executor
        .select({
          id: places.id,
          name: places.name,
          slug: places.slug,
          categoryName: categories.name,
          categoryColor: categories.color,
          municipalityName: municipalities.name,
        })
        .from(places)
        .innerJoin(categories, eq(categories.id, places.categoryId))
        .innerJoin(municipalities, eq(municipalities.id, places.municipalityId))
        .where(
          and(
            inArray(
              places.id,
              stamps.map((stamp) => stamp.placeId),
            ),
            eq(places.status, "published"),
          ),
        )
    : [];
  const byId = new Map(destinations.map(({ id, ...place }) => [id, place]));
  return {
    total: count?.total ?? 0,
    items: stamps.map((stamp) => ({
      id: stamp.id,
      stampedAt: stamp.stampedAt.toISOString(),
      place: byId.get(stamp.placeId) ?? null,
    })),
  };
}
