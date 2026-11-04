import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { call } from "@orpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  categories,
  consultations,
  contentReports,
  ecoRoutes,
  idempotencyKeys,
  jobOutbox,
  municipalities,
  notifications,
  places,
  realtimeEvents,
  trafficReports,
  user,
  userBlocks,
} from "@/db/schema";
import { IdempotencyConflictError } from "@/lib/idempotency";
import { openConsultation } from "@/modules/consultations/open-consultation";
import { reportTraffic } from "@/modules/traffic/report-traffic";
import { consultationsRouter } from "@/orpc/routers/consultations";
import { moderationRouter } from "@/orpc/routers/moderation";
import { placesRouter } from "@/orpc/routers/places";
import { routesRouter } from "@/orpc/routers/routes";
import { safetyRouter } from "@/orpc/routers/safety";
import { trafficRouter } from "@/orpc/routers/traffic";
import {
  assertDedicatedLocalDatabase,
  auditsFor,
  context,
  createMember,
} from "./support/test-db";

// Cache tags only exist inside the Next runtime; the decisions are what is under test.
mock.module("next/cache", () => ({
  revalidateTag: () => {},
  cacheLife: () => {},
  cacheTag: () => {},
}));

// Opt in with RUN_DB_TESTS=1 and a migrated, disposable loopback test database.
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "reporting, blocking and publication review",
  () => {
    const prefix = `safety-test-${crypto.randomUUID().slice(0, 8)}`;
    const townA = `${prefix}-a`;
    const townB = `${prefix}-b`;
    const placeCategory = `${prefix}-place`;
    const routeCategory = `${prefix}-route`;
    const caseCategory = `${prefix}-case`;
    const trafficCategory = `${prefix}-traffic`;
    const accounts: string[] = [];
    let guarded = false;

    async function member(options?: Parameters<typeof createMember>[1]) {
      const created = await createMember(prefix, options);
      accounts.push(created.id);
      return created;
    }

    async function place(authorId: string | null, status = "published") {
      const slug = `${prefix}-place-${crypto.randomUUID().slice(0, 8)}`;
      const [row] = await db
        .insert(places)
        .values({
          slug,
          name: `Synthetic ${slug}`,
          categoryId: placeCategory,
          municipalityId: townA,
          location: { x: -71.3, y: 19.45 },
          status: status as "published",
          createdByUserId: authorId,
        })
        .returning({ id: places.id, slug: places.slug });
      if (!row) throw new Error("place insert failed");
      return row;
    }

    async function route(authorId: string) {
      const [row] = await db
        .insert(ecoRoutes)
        .values({
          name: `${prefix} route`,
          description: "Synthetic route used by the safety suite",
          categoryId: routeCategory,
          municipalityId: townA,
          path: [
            { x: -71.3, y: 19.45 },
            { x: -71.31, y: 19.46 },
          ],
          distanceMeters: 1500,
          durationMinutes: 30,
          difficulty: "easy",
          status: "published",
          submittedByUserId: authorId,
        })
        .returning({ id: ecoRoutes.id });
      if (!row) throw new Error("route insert failed");
      return row.id;
    }

    function report(
      reporter: Awaited<ReturnType<typeof member>>,
      target: {
        kind: "place" | "photo" | "route" | "traffic" | "consultation";
        ref: string;
      },
      reason: "abuse" | "personal_information" | "unsafe" | "other" = "abuse",
    ) {
      return call(
        safetyRouter.report,
        { requestId: crypto.randomUUID(), target, reason },
        { context: context(reporter.viewer) },
      );
    }

    beforeAll(async () => {
      assertDedicatedLocalDatabase();
      guarded = true;
      await db.insert(municipalities).values([
        { id: townA, name: townA },
        { id: townB, name: townB },
      ]);
      await db.insert(categories).values([
        { id: placeCategory, kind: "place", name: `${prefix} place` },
        { id: routeCategory, kind: "route", name: `${prefix} route` },
        { id: caseCategory, kind: "consultation", name: `${prefix} case` },
        { id: trafficCategory, kind: "traffic", name: `${prefix} traffic` },
      ]);
    });

    afterAll(async () => {
      if (!guarded) return;
      await db.transaction(async (tx) => {
        const ownedCases = await tx
          .select({ id: consultations.id })
          .from(consultations)
          .where(eq(consultations.municipalityId, townA));
        const caseIds = ownedCases.map((row) => row.id);
        await tx
          .delete(contentReports)
          .where(inArray(contentReports.municipalityId, [townA, townB]));
        await tx
          .delete(userBlocks)
          .where(inArray(userBlocks.blockingUserId, accounts));
        const mine = await tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(inArray(notifications.userId, accounts));
        const notificationIds = mine.map((row) => row.id);
        if (notificationIds.length > 0) {
          await tx
            .delete(jobOutbox)
            .where(
              inArray(
                sql<string>`${jobOutbox.data}->>'notificationId'`,
                notificationIds,
              ),
            );
        }
        await tx
          .delete(realtimeEvents)
          .where(inArray(realtimeEvents.municipalityId, [townA, townB]));
        await tx
          .delete(auditEvents)
          .where(
            or(
              inArray(auditEvents.actorUserId, accounts),
              inArray(auditEvents.municipalityId, [townA, townB]),
            ),
          );
        await tx
          .delete(trafficReports)
          .where(inArray(trafficReports.municipalityId, [townA, townB]));
        if (caseIds.length > 0)
          await tx
            .delete(consultations)
            .where(inArray(consultations.id, caseIds));
        await tx
          .delete(ecoRoutes)
          .where(inArray(ecoRoutes.municipalityId, [townA, townB]));
        await tx
          .delete(places)
          .where(inArray(places.municipalityId, [townA, townB]));
        await tx
          .delete(idempotencyKeys)
          .where(inArray(idempotencyKeys.userId, accounts));
        await tx.delete(user).where(inArray(user.id, accounts));
        await tx
          .delete(categories)
          .where(
            inArray(categories.id, [
              placeCategory,
              routeCategory,
              caseCategory,
              trafficCategory,
            ]),
          );
        await tx
          .delete(municipalities)
          .where(inArray(municipalities.id, [townA, townB]));
      });
    });

    test("reports need a verified-contact member and a visible, known target", async () => {
      const author = await member();
      const reporter = await member();
      const unverified = await member({ contactVerified: false });
      const visible = await place(author.id);
      const pending = await place(author.id, "pending");

      await expect(
        call(
          safetyRouter.report,
          {
            requestId: crypto.randomUUID(),
            target: { kind: "place", ref: visible.slug },
            reason: "abuse",
          },
          { context: context({ kind: "anonymous" }) },
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(
        report(unverified, { kind: "place", ref: visible.slug }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "contact_verification_required" },
      });
      await expect(
        report(reporter, { kind: "place", ref: `${prefix}-missing` }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      // Pending content is not visible to others, so it cannot be probed.
      await expect(
        report(reporter, { kind: "place", ref: pending.slug }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        report(author, { kind: "place", ref: visible.slug }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        data: { reason: "own_content" },
      });
    });

    test("a report takes its municipality and author from the content, once per reporter", async () => {
      const author = await member();
      const reporter = await member();
      const target = await place(author.id);
      const requestId = crypto.randomUUID();
      const input = {
        requestId,
        target: { kind: "place" as const, ref: target.slug },
        reason: "personal_information" as const,
        details: "Shows a private phone number.",
      };
      const first = await call(safetyRouter.report, input, {
        context: context(reporter.viewer),
      });
      expect(first.status).toBe("open");

      // A retry of the same request, and a fresh request for the same content,
      // both return the one open report.
      const retry = await call(safetyRouter.report, input, {
        context: context(reporter.viewer),
      });
      expect(retry.id).toBe(first.id);
      const again = await report(reporter, { kind: "place", ref: target.id });
      expect(again.id).toBe(first.id);
      // The same request id with different content is refused.
      await expect(
        call(
          safetyRouter.report,
          { ...input, reason: "abuse" },
          { context: context(reporter.viewer) },
        ),
      ).rejects.toBeInstanceOf(IdempotencyConflictError);

      const [row] = await db
        .select()
        .from(contentReports)
        .where(eq(contentReports.id, first.id));
      expect(row).toMatchObject({
        municipalityId: townA,
        authorUserId: author.id,
        reporterUserId: reporter.id,
        subjectRef: target.slug,
      });
      expect(await auditsFor(reporter.id, "content.reported")).toHaveLength(1);
    });

    test("blocking hides raw contributions from the blocker only and is reversible", async () => {
      const author = await member();
      const blocker = await member();
      const bystander = await member();
      const hiddenPlace = await place(author.id);
      const officialPlace = await place(null);
      const hiddenRoute = await route(author.id);

      const anonymousBrowse = () =>
        call(
          placesRouter.browse,
          { municipality: townA, limit: 48, offset: 0 },
          { context: context({ kind: "anonymous" }) },
        );
      const browseAs = (viewer: typeof blocker.viewer) =>
        call(
          placesRouter.browse,
          { municipality: townA, limit: 48, offset: 0 },
          { context: context(viewer) },
        );
      expect(
        (await anonymousBrowse()).items.map((item) => item.slug),
      ).toContain(hiddenPlace.slug);

      const requestId = crypto.randomUUID();
      const input = {
        requestId,
        target: { kind: "place" as const, ref: hiddenPlace.slug },
      };
      const { blockId } = await call(safetyRouter.blockAuthor, input, {
        context: context(blocker.viewer),
      });
      // Retrying, or blocking through another piece of the same author's content, reuses the block.
      expect(
        (
          await call(safetyRouter.blockAuthor, input, {
            context: context(blocker.viewer),
          })
        ).blockId,
      ).toBe(blockId);
      expect(
        (
          await call(
            safetyRouter.blockAuthor,
            {
              requestId: crypto.randomUUID(),
              target: { kind: "route", ref: hiddenRoute },
            },
            { context: context(blocker.viewer) },
          )
        ).blockId,
      ).toBe(blockId);

      const blockerSees = (await browseAs(blocker.viewer)).items.map(
        (item) => item.slug,
      );
      expect(blockerSees).not.toContain(hiddenPlace.slug);
      expect(blockerSees).toContain(officialPlace.slug);
      expect(
        (await browseAs(bystander.viewer)).items.map((item) => item.slug),
      ).toContain(hiddenPlace.slug);
      await expect(
        call(
          placesRouter.detail,
          { slug: hiddenPlace.slug },
          { context: context(blocker.viewer) },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        call(
          routesRouter.detail,
          { id: hiddenRoute },
          { context: context(blocker.viewer) },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        (
          await call(
            routesRouter.detail,
            { id: hiddenRoute },
            { context: context(bystander.viewer) },
          )
        ).id,
      ).toBe(hiddenRoute);

      const listed = await call(safetyRouter.blocks, undefined, {
        context: context(blocker.viewer),
      });
      expect(listed).toHaveLength(1);
      expect(Object.keys(listed[0] ?? {}).sort()).toEqual([
        "displayName",
        "id",
      ]);

      const hidden = await call(
        safetyRouter.hiddenTargets,
        { limit: 1 },
        { context: context(blocker.viewer) },
      );
      expect(hidden.items).toHaveLength(1);
      expect(hidden.nextCursor).not.toBeNull();
      const rest = await call(
        safetyRouter.hiddenTargets,
        { limit: 10, cursor: hidden.nextCursor ?? undefined },
        { context: context(blocker.viewer) },
      );
      const everything = [...hidden.items, ...rest.items];
      expect(everything).toEqual(
        expect.arrayContaining([
          { kind: "place", ref: hiddenPlace.slug },
          { kind: "route", ref: hiddenRoute },
        ]),
      );
      expect(rest.nextCursor).toBeNull();
      expect(
        (
          await call(
            safetyRouter.hiddenTargets,
            { limit: 10 },
            { context: context(bystander.viewer) },
          )
        ).items,
      ).toEqual([]);

      // Somebody else's block id removes nothing; the owner's removes it.
      expect(
        await call(
          safetyRouter.unblock,
          { requestId: crypto.randomUUID(), blockId },
          { context: context(bystander.viewer) },
        ),
      ).toEqual({ removed: false });
      expect(
        await call(
          safetyRouter.unblock,
          { requestId: crypto.randomUUID(), blockId },
          { context: context(blocker.viewer) },
        ),
      ).toEqual({ removed: true });
      expect(
        (await browseAs(blocker.viewer)).items.map((item) => item.slug),
      ).toContain(hiddenPlace.slug);
    });

    test("institutional records, staff authors and oneself cannot be blocked", async () => {
      const blocker = await member();
      const staff = await member({
        staff: { role: "moderator", municipalityId: townA },
      });
      const seeded = await place(null);
      const staffPlace = await place(staff.id);
      const own = await place(blocker.id);
      const block = (ref: string) =>
        call(
          safetyRouter.blockAuthor,
          { requestId: crypto.randomUUID(), target: { kind: "place", ref } },
          { context: context(blocker.viewer) },
        );
      await expect(block(seeded.slug)).rejects.toMatchObject({
        data: { reason: "no_author" },
      });
      await expect(block(staffPlace.slug)).rejects.toMatchObject({
        data: { reason: "institutional_author" },
      });
      await expect(block(own.slug)).rejects.toMatchObject({
        data: { reason: "own_content" },
      });
      // The seeded record can still be reported.
      expect(
        (await report(blocker, { kind: "place", ref: seeded.slug })).status,
      ).toBe("open");
    });

    test("a new case is visible to its author only until staff publish it", async () => {
      const author = await member({ municipalityId: townA });
      const other = await member();
      const staffA = await member({
        staff: { role: "moderator", municipalityId: townA },
      });
      const staffB = await member({
        staff: { role: "moderator", municipalityId: townB },
      });

      const opened = await openConsultation(author.viewer, {
        requestId: crypto.randomUUID(),
        categoryId: caseCategory,
        municipalityId: townA,
        title: "Synthetic pending case title",
        body: "A synthetic case body that is long enough to satisfy the minimum length requirement.",
      });
      expect(opened.publicationStatus).toBe("pending");
      const [{ id: caseId } = { id: "" }] = await db
        .select({ id: consultations.id })
        .from(consultations)
        .where(eq(consultations.slug, opened.slug));

      const list = (viewer: typeof author.viewer | { kind: "anonymous" }) =>
        call(
          consultationsRouter.browse,
          {
            municipality: townA,
            category: "",
            mine: false,
            offset: 0,
            limit: 12,
          },
          { context: context(viewer) },
        );
      expect((await list({ kind: "anonymous" })).items).toHaveLength(0);
      expect((await list(other.viewer)).items).toHaveLength(0);
      // The author's own list shows it with its review state, and so does detail.
      const mine = await call(
        consultationsRouter.browse,
        { municipality: "", category: "", mine: true, offset: 0, limit: 12 },
        { context: context(author.viewer) },
      );
      expect(mine.items.map((item) => item.publicationStatus)).toEqual([
        "pending",
      ]);
      expect(
        (
          await call(
            consultationsRouter.detail,
            { slug: opened.slug },
            { context: context(author.viewer) },
          )
        ).isMine,
      ).toBe(true);
      await expect(
        call(
          consultationsRouter.detail,
          { slug: opened.slug },
          { context: context(other.viewer) },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        call(
          consultationsRouter.detail,
          { slug: opened.slug },
          { context: context({ kind: "anonymous" }) },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        call(
          consultationsRouter.support,
          { consultationId: caseId, supported: true },
          { context: context(other.viewer) },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(
        await db
          .select()
          .from(realtimeEvents)
          .where(eq(realtimeEvents.subjectId, caseId)),
      ).toHaveLength(0);

      const decision = {
        requestId: crypto.randomUUID(),
        target: { kind: "consultation" as const, ref: caseId },
        status: "published" as const,
      };
      await expect(
        call(moderationRouter.decidePublication, decision, {
          context: context(staffB.viewer),
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        data: { reason: "municipality_scope" },
      });
      await expect(
        call(moderationRouter.decidePublication, decision, {
          context: context(other.viewer),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        await call(moderationRouter.decidePublication, decision, {
          context: context(staffA.viewer),
        }),
      ).toEqual({ status: "published" });
      // A retry changes and notifies nothing more.
      await call(moderationRouter.decidePublication, decision, {
        context: context(staffA.viewer),
      });

      expect(
        (await list({ kind: "anonymous" })).items.map((item) => item.slug),
      ).toEqual([opened.slug]);
      expect(
        (
          await call(
            consultationsRouter.support,
            { consultationId: caseId, supported: true },
            { context: context(other.viewer) },
          )
        ).supportCount,
      ).toBe(2);
      expect(
        await db
          .select()
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, author.id),
              eq(
                notifications.messageKey,
                "notifications.consultationPublished",
              ),
            ),
          ),
      ).toHaveLength(1);
      expect(await auditsFor(staffA.id, "consultation.published")).toHaveLength(
        1,
      );

      // Hiding needs a reason and removes it from every public read again.
      await expect(
        call(
          moderationRouter.decidePublication,
          {
            requestId: crypto.randomUUID(),
            target: { kind: "consultation", ref: caseId },
            status: "hidden",
          },
          { context: context(staffA.viewer) },
        ),
      ).rejects.toBeDefined();
      await call(
        moderationRouter.decidePublication,
        {
          requestId: crypto.randomUUID(),
          target: { kind: "consultation", ref: caseId },
          status: "hidden",
          reason: "Contains a neighbour's private address.",
        },
        { context: context(staffA.viewer) },
      );
      expect((await list({ kind: "anonymous" })).items).toHaveLength(0);
    });

    test("a traffic report warns at once while its free text waits for review", async () => {
      const author = await member();
      const other = await member();
      const staff = await member({
        staff: { role: "moderator", municipalityId: townA },
      });
      // Street-shaped lookups need imported roads; a point report does not.
      const [row] = await db
        .insert(trafficReports)
        .values({
          categoryId: trafficCategory,
          municipalityId: townA,
          location: { x: -71.3, y: 19.45 },
          description: "Synthetic held-back text",
          reportedByUserId: author.id,
          expiresAt: new Date(Date.now() + 3_600_000),
        })
        .returning({ id: trafficReports.id });
      if (!row) throw new Error("traffic insert failed");
      const area = {
        west: -71.4,
        south: 19.4,
        east: -71.2,
        north: 19.5,
        limit: 50,
      };
      const read = async (
        viewer: typeof author.viewer | { kind: "anonymous" },
      ) =>
        (
          await call(trafficRouter.active, area, { context: context(viewer) })
        ).find((item) => item.id === row.id);

      expect(await read({ kind: "anonymous" })).toMatchObject({
        description: null,
        descriptionModerationStatus: "pending",
      });
      expect(await read(other.viewer)).toMatchObject({ description: null });
      expect(await read(author.viewer)).toMatchObject({
        description: "Synthetic held-back text",
        descriptionModerationStatus: "pending",
      });

      const decide = (status: "published" | "hidden", reason?: string) =>
        call(
          moderationRouter.decidePublication,
          {
            requestId: crypto.randomUUID(),
            target: { kind: "traffic", ref: row.id },
            status,
            reason,
          },
          { context: context(staff.viewer) },
        );
      await decide("published");
      expect(await read({ kind: "anonymous" })).toMatchObject({
        description: "Synthetic held-back text",
        descriptionModerationStatus: "published",
      });
      await decide("hidden", "Names a private person.");
      expect(await read(other.viewer)).toMatchObject({
        description: null,
        descriptionModerationStatus: "hidden",
      });
      // The warning itself stays on the map.
      expect(await read(other.viewer)).toBeDefined();
      void reportTraffic;
    });

    test("actioning a report hides the content for everyone, scoped to the staff member's municipality", async () => {
      const author = await member();
      const reporterOne = await member();
      const reporterTwo = await member();
      const staffA = await member({
        staff: { role: "moderator", municipalityId: townA },
      });
      const staffB = await member({
        staff: { role: "moderator", municipalityId: townB },
      });
      const target = await place(author.id);

      const first = await report(
        reporterOne,
        { kind: "place", ref: target.slug },
        "other",
      );
      const second = await report(
        reporterTwo,
        { kind: "place", ref: target.slug },
        "unsafe",
      );
      const queue = await call(
        moderationRouter.queue,
        { queue: "contentReports", limit: 20 },
        { context: context(staffA.viewer) },
      );
      const queued = queue.contentReports.filter(
        (item) => item.subject.ref === target.slug,
      );
      // One row per content, led by the report that needs attention first.
      expect(queued).toHaveLength(1);
      expect(queued[0]).toMatchObject({
        id: second.id,
        priority: true,
        openReportCount: 2,
        subjectTitle: expect.stringContaining(prefix),
      });
      expect(
        (
          await call(
            moderationRouter.queue,
            { queue: "contentReports", limit: 20 },
            { context: context(staffB.viewer) },
          )
        ).contentReports.filter((item) => item.subject.ref === target.slug),
      ).toHaveLength(0);

      const decision = {
        requestId: crypto.randomUUID(),
        reportId: second.id,
        decision: "actioned" as const,
        reason: "Confirmed threat against a neighbour.",
      };
      await expect(
        call(moderationRouter.decideContentReport, decision, {
          context: context(staffB.viewer),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        await call(moderationRouter.decideContentReport, decision, {
          context: context(staffA.viewer),
        }),
      ).toEqual({ status: "actioned" });

      const [stored] = await db
        .select({ status: places.status })
        .from(places)
        .where(eq(places.id, target.id));
      expect(stored?.status).toBe("archived");
      const rows = await db
        .select()
        .from(contentReports)
        .where(inArray(contentReports.id, [first.id, second.id]));
      expect(rows.map((row) => row.status)).toEqual(["actioned", "actioned"]);
      await expect(
        call(
          placesRouter.detail,
          { slug: target.slug },
          { context: context({ kind: "anonymous" }) },
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      // The author is told which item, never who reported it.
      const told = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, author.id),
            eq(notifications.messageKey, "notifications.contentRemoved"),
          ),
        );
      expect(told).toHaveLength(1);
      expect(JSON.stringify(told[0])).not.toContain(reporterOne.id);
      // Deciding again is a conflict, not a second removal.
      await expect(
        call(
          moderationRouter.decideContentReport,
          { ...decision, requestId: crypto.randomUUID() },
          { context: context(staffA.viewer) },
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
  },
);
