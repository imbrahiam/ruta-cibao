import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import {
  auditEvents,
  identityReviews,
  jobOutbox,
  memberProfiles,
  municipalities,
  notifications,
  user,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { drainOutbox, enqueueJob } from "@/lib/jobs/outbox";
import { QUEUES } from "@/lib/jobs/queues";
import { consumeRollingRateLimit } from "@/lib/rate-limit";
import { requireModerator } from "@/modules/access/permissions";
import { toViewer } from "@/modules/access/viewer";
import { decideReview, listReviews } from "@/modules/identity/review";
import { notify } from "@/modules/notifications/notify";

// Explicit opt-in: the caller must supply a dedicated database with migrations.
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "production guarantees",
  () => {
    const prefix = `review-${crypto.randomUUID()}`;
    const municipalityId = `${prefix}-town`;
    const applicantId = `${prefix}-applicant`;
    const moderatorId = `${prefix}-moderator`;
    let moderator: ReturnType<typeof requireModerator>;
    beforeAll(async () => {
      await db
        .insert(municipalities)
        .values({ id: municipalityId, name: "Test municipality" });
      await db.insert(user).values([
        {
          id: applicantId,
          name: "Applicant",
          email: `${applicantId}@example.invalid`,
        },
        {
          id: moderatorId,
          name: "Reviewer",
          email: `${moderatorId}@example.invalid`,
        },
      ]);
      await db.insert(memberProfiles).values([
        {
          userId: applicantId,
          displayName: "Applicant",
          municipalityId,
          cedulaStatus: "in_review",
          verifiedFullName: "APPLICANT NAME",
        },
        {
          userId: moderatorId,
          displayName: "Reviewer",
          municipalityId,
          tier: "citizen",
          cedulaStatus: "verified",
          staffRole: "moderator",
          verifiedFullName: "REVIEWER NAME",
        },
      ]);
      const [profile] = await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, moderatorId));
      if (!profile) throw new Error("Fixture profile missing");
      moderator = requireModerator(toViewer(moderatorId, profile, null));
    });
    afterAll(async () => {
      await db
        .delete(identityReviews)
        .where(eq(identityReviews.municipalityId, municipalityId));
      await db
        .delete(user)
        .where(sql`${user.id} in (${applicantId}, ${moderatorId})`);
      await db
        .delete(municipalities)
        .where(eq(municipalities.id, municipalityId));
      await pool.end();
    });
    test("a failed audit rolls back its domain mutation and outbox", async () => {
      const reportId = crypto.randomUUID();
      await expect(
        db.transaction(async (tx) => {
          await tx
            .update(memberProfiles)
            .set({ displayName: "Changed" })
            .where(eq(memberProfiles.userId, applicantId));
          await enqueueJob(tx, QUEUES.trafficNotifyNearby, {
            reportId,
          });
          await recordAudit(
            {
              actorUserId: "missing-user",
              action: "test.invalid",
              subjectType: "test",
            },
            tx,
          );
        }),
      ).rejects.toThrow();
      const [profile] = await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, applicantId));
      expect(profile?.displayName).toBe("Applicant");
      const [jobs] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobOutbox)
        .where(sql`${jobOutbox.data}->>'reportId' = ${reportId}`);
      expect(jobs?.count).toBe(0);
    });
    test("concurrent reservations share a single rolling allowance", async () => {
      const answers = await Promise.all(
        Array.from({ length: 8 }, () =>
          consumeRollingRateLimit(prefix, {
            scope: "integration",
            limit: 3,
            windowMs: 3_600_000,
          }),
        ),
      );
      expect(answers.filter((answer) => answer.allowed)).toHaveLength(3);
      expect(
        answers
          .filter((answer) => !answer.allowed)
          .every((answer) => answer.retryAfterSeconds > 0),
      ).toBe(true);
    });
    test("notification and event commit once; outbound work is durable", async () => {
      const input = {
        dedupeKey: prefix,
        userId: applicantId,
        messageKey: "notifications.identitySubmitted",
        channels: { push: false, email: false },
      };
      await notify(input);
      await notify(input);
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.dedupeKey, prefix));
      expect(rows).toHaveLength(1);
      expect(await drainOutbox()).toBeGreaterThanOrEqual(1);
      const [delivered] = await db
        .select()
        .from(jobOutbox)
        .where(sql`${jobOutbox.data}->>'notificationId' = ${rows[0]?.id}`);
      expect(delivered?.processedAt).toBeInstanceOf(Date);
      expect(await drainOutbox()).toBe(0);
    });
    test("only one concurrent reviewer decision changes the identity", async () => {
      const reviewId = crypto.randomUUID();
      // Mark documents purged so this DB-only test cannot call object storage.
      await db.insert(identityReviews).values({
        id: reviewId,
        userId: applicantId,
        municipalityId,
        frontKey: "test/front",
        selfieKey: "test/selfie",
        documentsPurgedAt: new Date(),
      });
      const results = await Promise.allSettled([
        decideReview(moderator, {
          reviewId,
          decision: "reject",
          reason: "incomplete",
        }),
        decideReview(moderator, {
          reviewId,
          decision: "reject",
          reason: "mismatch",
        }),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const [profile] = await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, applicantId));
      expect(profile?.tier).toBe("visitor");
      expect(profile?.cedulaStatus).toBe("matched");
      const audits = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.subjectId, reviewId));
      expect(
        audits.filter((event) => event.action === "identity_review.rejected"),
      ).toHaveLength(1);
    });
    test("a moderator cannot list requests from another municipality", async () => {
      const outside = { ...moderator, scope: [`${prefix}-outside`] };
      expect(
        await listReviews(outside, { status: "decided", limit: 50 }),
      ).toHaveLength(0);
    });
  },
);
