import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  businessClaims,
  categories,
  idempotencyKeys,
  jobOutbox,
  municipalities,
  notifications,
  placePhotos,
  placeReports,
  places,
  realtimeEvents,
  user,
} from "@/db/schema";
import { requireModerator } from "@/modules/access/permissions";
import {
  decideBusinessClaim,
  decidePhoto,
  decidePlace,
  decideReport,
  ModerationError,
} from "@/modules/moderation/decide";
import {
  assertDedicatedLocalDatabase,
  auditsFor,
  createMember,
} from "./support/test-db";

// Cache tags only exist inside the Next runtime; the decisions are what is under test.
mock.module("next/cache", () => ({
  revalidateTag: () => {},
  cacheLife: () => {},
  cacheTag: () => {},
}));

/**
 * The transitions a moderator can make, and the promises each one carries:
 * the row moves, the trail records who moved it, the author is told, the
 * municipality scope is enforced, and a retried request does not repeat any
 * of it.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "moderation decisions",
  () => {
    const prefix = `moderation-test-${crypto.randomUUID().slice(0, 8)}`;
    const townA = `${prefix}-a`;
    const townB = `${prefix}-b`;
    const placeCategory = `${prefix}-place`;
    const accounts: string[] = [];
    let guarded = false;

    async function member(options?: Parameters<typeof createMember>[1]) {
      const created = await createMember(prefix, options);
      accounts.push(created.id);
      return created;
    }

    async function moderator(scope: string | "all") {
      const created =
        scope === "all"
          ? await member({ staff: { role: "admin" } })
          : await member({
              staff: { role: "moderator", municipalityId: scope },
            });
      return requireModerator(created.viewer);
    }

    async function place(
      authorId: string | null,
      options: {
        status?: "pending" | "published";
        municipalityId?: string;
      } = {},
    ) {
      const slug = `${prefix}-place-${crypto.randomUUID().slice(0, 8)}`;
      const [row] = await db
        .insert(places)
        .values({
          slug,
          name: `Synthetic ${slug}`,
          categoryId: placeCategory,
          municipalityId: options.municipalityId ?? townA,
          location: { x: -71.3, y: 19.45 },
          status: options.status ?? "pending",
          createdByUserId: authorId,
        })
        .returning({ id: places.id, slug: places.slug });
      if (!row) throw new Error("place insert failed");
      return row;
    }

    async function photo(placeId: string, uploaderId: string) {
      const [row] = await db
        .insert(placePhotos)
        .values({
          placeId,
          uploadedByUserId: uploaderId,
          storageKey: `${prefix}/photo-${crypto.randomUUID()}.jpg`,
        })
        .returning({ id: placePhotos.id });
      if (!row) throw new Error("photo insert failed");
      return row.id;
    }

    async function claim(placeId: string, claimantUserId: string) {
      const [row] = await db
        .insert(businessClaims)
        .values({
          placeId,
          claimantUserId,
          evidence: "Synthetic RNC and a utility bill.",
        })
        .returning({ id: businessClaims.id });
      if (!row) throw new Error("claim insert failed");
      return row.id;
    }

    async function placeReport(placeId: string, reporterUserId: string) {
      const [row] = await db
        .insert(placeReports)
        .values({
          placeId,
          reporterUserId,
          reason: "incorrect_information",
          details: "Synthetic report.",
        })
        .returning({ id: placeReports.id });
      if (!row) throw new Error("report insert failed");
      return row.id;
    }

    beforeAll(async () => {
      assertDedicatedLocalDatabase();
      guarded = true;
      await db.insert(municipalities).values([
        { id: townA, name: townA },
        { id: townB, name: townB },
      ]);
      await db
        .insert(categories)
        .values({ id: placeCategory, kind: "place", name: `${prefix} place` });
    });

    afterAll(async () => {
      if (!guarded) return;
      await db.transaction(async (tx) => {
        const ownedPlaces = await tx
          .select({ id: places.id })
          .from(places)
          .where(inArray(places.municipalityId, [townA, townB]));
        const placeIds = ownedPlaces.map((row) => row.id);
        const mine = await tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(inArray(notifications.userId, accounts));
        const notificationIds = mine.map((row) => row.id);
        if (notificationIds.length > 0) {
          await tx
            .delete(jobOutbox)
            .where(inArray(jobOutbox.queue, ["offline.snapshot"]));
        }
        await tx
          .delete(auditEvents)
          .where(inArray(auditEvents.actorUserId, accounts));
        await tx
          .delete(auditEvents)
          .where(inArray(auditEvents.municipalityId, [townA, townB]));
        if (notificationIds.length > 0) {
          await tx
            .delete(auditEvents)
            .where(
              and(
                eq(auditEvents.subjectType, "notification"),
                inArray(auditEvents.subjectId, notificationIds),
              ),
            );
        }
        await tx
          .delete(realtimeEvents)
          .where(inArray(realtimeEvents.municipalityId, [townA, townB]));
        await tx.delete(realtimeEvents).where(
          inArray(
            realtimeEvents.channel,
            accounts.map((id) => `user:${id}`),
          ),
        );
        if (notificationIds.length > 0) {
          await tx
            .delete(notifications)
            .where(inArray(notifications.id, notificationIds));
        }
        if (placeIds.length > 0) {
          await tx
            .delete(placeReports)
            .where(inArray(placeReports.placeId, placeIds));
          await tx
            .delete(placePhotos)
            .where(inArray(placePhotos.placeId, placeIds));
        }
        await tx
          .delete(businessClaims)
          .where(inArray(businessClaims.claimantUserId, accounts));
        if (placeIds.length > 0) {
          await tx.delete(places).where(inArray(places.id, placeIds));
        }
        await tx
          .delete(idempotencyKeys)
          .where(inArray(idempotencyKeys.userId, accounts));
        await tx.delete(user).where(inArray(user.id, accounts));
        await tx
          .delete(categories)
          .where(inArray(categories.id, [placeCategory]));
        await tx
          .delete(municipalities)
          .where(inArray(municipalities.id, [townA, townB]));
      });
    });

    test("a place decision moves once, stays in scope, and tells the author", async () => {
      const author = await member();
      const editorA = await moderator(townA);
      const editorB = await moderator(townB);
      const target = await place(author.id);
      const requestId = crypto.randomUUID();

      await expect(
        decidePlace(editorB, {
          requestId: crypto.randomUUID(),
          placeId: target.id,
          decision: "publish",
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "municipality_scope" },
      });
      const [untouched] = await db
        .select({ status: places.status })
        .from(places)
        .where(eq(places.id, target.id));
      expect(untouched?.status).toBe("pending");

      await decidePlace(editorA, {
        requestId,
        placeId: target.id,
        decision: "publish",
      });
      const [published] = await db
        .select({
          status: places.status,
          reviewedByUserId: places.reviewedByUserId,
          publishedAt: places.publishedAt,
        })
        .from(places)
        .where(eq(places.id, target.id));
      expect(published?.status).toBe("published");
      expect(published?.reviewedByUserId).toBe(editorA.userId);
      expect(published?.publishedAt).toBeInstanceOf(Date);

      expect((await auditsFor(editorA.userId, "place.published")).length).toBe(
        1,
      );
      const authorNotifications = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, author.id));
      expect(
        authorNotifications.filter(
          (row) => row.messageKey === "notifications.placeApproved",
        ).length,
      ).toBe(1);

      // A retry of the same request is a replay, not a second decision.
      await decidePlace(editorA, {
        requestId,
        placeId: target.id,
        decision: "publish",
      });
      expect((await auditsFor(editorA.userId, "place.published")).length).toBe(
        1,
      );
      const afterReplay = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, author.id));
      expect(
        afterReplay.filter(
          (row) => row.messageKey === "notifications.placeApproved",
        ).length,
      ).toBe(1);

      await expect(
        decidePlace(editorA, {
          requestId: crypto.randomUUID(),
          placeId: target.id,
          decision: "reject",
          note: "Already handled in the queue.",
        }),
      ).rejects.toBeInstanceOf(ModerationError);
    });

    test("a photo decision refuses another municipality and moves only once", async () => {
      const author = await member();
      const editorA = await moderator(townA);
      const editorB = await moderator(townB);
      const target = await place(author.id, { status: "published" });
      const photoId = await photo(target.id, author.id);

      await expect(
        decidePhoto(editorB, {
          requestId: crypto.randomUUID(),
          photoId,
          decision: "publish",
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await decidePhoto(editorA, {
        requestId: crypto.randomUUID(),
        photoId,
        decision: "reject",
      });
      const [row] = await db
        .select({
          status: placePhotos.status,
          reviewedByUserId: placePhotos.reviewedByUserId,
        })
        .from(placePhotos)
        .where(eq(placePhotos.id, photoId));
      expect(row?.status).toBe("rejected");
      expect(row?.reviewedByUserId).toBe(editorA.userId);
      expect(
        (await auditsFor(editorA.userId, "place_photo.rejected")).length,
      ).toBe(1);

      await expect(
        decidePhoto(editorA, {
          requestId: crypto.randomUUID(),
          photoId,
          decision: "publish",
        }),
      ).rejects.toThrow("already_decided");
    });

    test("a claim approval is exclusive, and a rejection carries a reason", async () => {
      const claimant = await member();
      const rival = await member();
      const editorA = await moderator(townA);
      const target = await place(null, { status: "published" });
      const first = await claim(target.id, claimant.id);
      const second = await claim(target.id, rival.id);

      await decideBusinessClaim(editorA, {
        requestId: crypto.randomUUID(),
        claimId: first,
        decision: "approve",
      });
      const [approved] = await db
        .select({
          status: businessClaims.status,
          decidedAt: businessClaims.decidedAt,
          reviewedByUserId: businessClaims.reviewedByUserId,
        })
        .from(businessClaims)
        .where(eq(businessClaims.id, first));
      expect(approved?.status).toBe("approved");
      expect(approved?.decidedAt).toBeInstanceOf(Date);
      expect(approved?.reviewedByUserId).toBe(editorA.userId);
      expect(
        (await auditsFor(editorA.userId, "business_claim.approved")).length,
      ).toBe(1);

      // The partial unique index is the second line of defence: the rival's
      // approval fails inside the transaction and leaves their claim pending.
      await expect(
        decideBusinessClaim(editorA, {
          requestId: crypto.randomUUID(),
          claimId: second,
          decision: "approve",
        }),
      ).rejects.toBeDefined();
      const [stillPending] = await db
        .select({ status: businessClaims.status })
        .from(businessClaims)
        .where(eq(businessClaims.id, second));
      expect(stillPending?.status).toBe("pending");

      const otherPlace = await place(null, { status: "published" });
      const third = await claim(otherPlace.id, rival.id);
      await decideBusinessClaim(editorA, {
        requestId: crypto.randomUUID(),
        claimId: third,
        decision: "reject",
        note: "The evidence names a different business.",
      });
      const [rejected] = await db
        .select({
          status: businessClaims.status,
          reviewNote: businessClaims.reviewNote,
        })
        .from(businessClaims)
        .where(eq(businessClaims.id, third));
      expect(rejected?.status).toBe("rejected");
      expect(rejected?.reviewNote).toContain("different business");
    });

    test("a report decision resolves once and replays safely", async () => {
      const reporter = await member();
      const editorA = await moderator(townA);
      const target = await place(null, { status: "published" });
      const reportId = await placeReport(target.id, reporter.id);
      const input = {
        requestId: crypto.randomUUID(),
        reportId,
        decision: "resolved" as const,
        note: "Corrected on the place.",
      };

      await decideReport(editorA, input);
      const [resolved] = await db
        .select({ status: placeReports.status })
        .from(placeReports)
        .where(eq(placeReports.id, reportId));
      expect(resolved?.status).toBe("resolved");
      expect(
        (await auditsFor(editorA.userId, "place_report.resolved")).length,
      ).toBe(1);

      await decideReport(editorA, input);
      expect(
        (await auditsFor(editorA.userId, "place_report.resolved")).length,
      ).toBe(1);

      await expect(
        decideReport(editorA, {
          requestId: crypto.randomUUID(),
          reportId,
          decision: "dismissed",
        }),
      ).rejects.toThrow("already_decided");
    });
  },
);
