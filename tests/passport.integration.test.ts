import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  auditEvents,
  categories,
  memberProfiles,
  municipalities,
  passportStamps,
  places,
  user,
} from "@/db/schema";
import { requireMember } from "@/modules/access/permissions";
import { type MemberViewer, toViewer } from "@/modules/access/viewer";
import {
  passportStatus,
  readPassport,
  stampVisit,
} from "@/modules/passport/service";
import { passportRouter } from "@/orpc/routers/passport";

describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "private tourist passport",
  () => {
    const prefix = `passport-test-${crypto.randomUUID()}`;
    const memberId = `${prefix}-member`;
    const otherId = `${prefix}-other`;
    const placeId = crypto.randomUUID();
    const hiddenId = crypto.randomUUID();
    let viewer: MemberViewer;
    let other: MemberViewer;
    const fix = (id = placeId) => ({
      placeId: id,
      position: { lng: -71.3, lat: 19.45 },
      accuracyMeters: 10,
      capturedAt: new Date().toISOString(),
    });
    beforeAll(async () => {
      await db.insert(municipalities).values({ id: prefix, name: prefix });
      await db
        .insert(categories)
        .values({ id: prefix, kind: "place", name: prefix });
      await db.insert(user).values(
        [memberId, otherId].map((id) => ({
          id,
          name: id,
          email: `${id}@example.invalid`,
        })),
      );
      await db.insert(memberProfiles).values(
        [memberId, otherId].map((userId) => ({
          userId,
          displayName: "Test visitor",
        })),
      );
      const profiles = await db
        .select()
        .from(memberProfiles)
        .where(inArray(memberProfiles.userId, [memberId, otherId]));
      viewer = requireMember(
        toViewer(
          memberId,
          profiles.find((p) => p.userId === memberId),
          { image: null, contactVerified: true },
        ),
      );
      other = requireMember(
        toViewer(
          otherId,
          profiles.find((p) => p.userId === otherId),
          { image: null, contactVerified: true },
        ),
      );
      await db.insert(places).values(
        [placeId, hiddenId].map((id) => ({
          id,
          slug: `${prefix}-${id}`,
          name: "Test destination",
          categoryId: prefix,
          municipalityId: prefix,
          location: { x: -71.3, y: 19.45 },
          status:
            id === placeId ? ("published" as const) : ("pending" as const),
        })),
      );
    });
    afterAll(async () => {
      await db
        .delete(auditEvents)
        .where(inArray(auditEvents.actorUserId, [memberId, otherId]));
      await db.delete(user).where(inArray(user.id, [memberId, otherId]));
      await db.delete(places).where(inArray(places.id, [placeId, hiddenId]));
      await db.delete(categories).where(eq(categories.id, prefix));
      await db.delete(municipalities).where(eq(municipalities.id, prefix));
      await pool.end();
    });
    test("anonymous requests cannot read or stamp a passport", async () => {
      const context = {
        db,
        headers: new Headers(),
        getViewer: async () => ({ kind: "anonymous" as const }),
        getSession: async () => ({
          viewer: { kind: "anonymous" as const },
          contact: null,
          session: null,
        }),
        requireStaffSession: async () => {},
      };
      await expect(
        call(passportRouter.list, {}, { context }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        call(passportRouter.stamp, fix(), { context }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    });
    test("distant fixes and unpublished places never create a stamp", async () => {
      await expect(
        stampVisit(viewer, { ...fix(), position: { lng: -70, lat: 19 } }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        data: { reason: "too_far" },
      });
      await expect(stampVisit(viewer, fix(hiddenId))).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(
        (await readPassport(db, viewer, { limit: 24, offset: 0 })).total,
      ).toBe(0);
    });
    test("concurrent retries create one encrypted stamp and one audit", async () => {
      const results = await Promise.all([
        stampVisit(viewer, fix()),
        stampVisit(viewer, fix()),
        stampVisit(viewer, fix()),
      ]);
      expect(new Set(results.map((r) => r.id)).size).toBe(1);
      expect(results.filter((r) => r.created)).toHaveLength(1);
      const stored = await db.execute<{ place_id: string }>(
        sql`select place_id from passport_stamps where user_id = ${memberId}`,
      );
      expect(stored.rows[0]?.place_id.startsWith("v1:")).toBe(true);
      expect(stored.rows[0]?.place_id).not.toContain(placeId);
      const audits = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.actorUserId, memberId),
            eq(auditEvents.action, "passport.stamped"),
          ),
        );
      expect(audits).toHaveLength(1);
      expect(audits[0]?.metadata).toEqual({});
      expect(
        (await readPassport(db, viewer, { limit: 24, offset: 0 })).items[0]
          ?.place?.name,
      ).toBe("Test destination");
      expect(
        (await readPassport(db, other, { limit: 24, offset: 0 })).total,
      ).toBe(0);
      expect((await passportStatus(db, other, placeId)).stampedAt).toBeNull();
    });
    test("archiving a place preserves the private stamp without showing withdrawn content", async () => {
      await db
        .update(places)
        .set({ status: "archived" })
        .where(eq(places.id, placeId));
      const passport = await readPassport(db, viewer, { limit: 24, offset: 0 });
      expect(passport.total).toBe(1);
      expect(passport.items[0]?.place).toBeNull();
      expect(
        (
          await db
            .select()
            .from(passportStamps)
            .where(eq(passportStamps.userId, memberId))
        ).length,
      ).toBe(1);
    });
  },
);
