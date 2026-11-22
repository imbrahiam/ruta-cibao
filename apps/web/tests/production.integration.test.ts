import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditEvents,
  categories,
  consultations,
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
import {
  type ModeratorViewer,
  requireModerator,
} from "@/modules/access/permissions";
import { setResidencyVerified, updateProfile } from "@/modules/access/profile";
import { type MemberViewer, toViewer } from "@/modules/access/viewer";
import {
  ConsultationError,
  openConsultation,
} from "@/modules/consultations/open-consultation";
import { notify } from "@/modules/notifications/notify";

// Explicit opt-in: the caller must supply a dedicated database with migrations.
describe.skipIf(process.env.RUN_DB_TESTS !== "1")(
  "production guarantees",
  () => {
    const prefix = `review-${crypto.randomUUID()}`;
    const municipalityId = `${prefix}-town`;
    const otherMunicipalityId = `${prefix}-other`;
    const insideMunicipalityId = `${prefix}-inside`;
    const adjacentMunicipalityId = `${prefix}-adjacent`;
    const consultationCategoryId = `${prefix}-case`;
    const applicantId = `${prefix}-applicant`;
    const moderatorId = `${prefix}-moderator`;
    let moderator: ModeratorViewer;
    let applicant: MemberViewer;

    /** A small synthetic square in the Gulf of Guinea, away from real borders. */
    function square(west: number, south: number): string {
      const east = west + 0.01;
      const north = south + 0.01;
      return `SRID=4326;MULTIPOLYGON(((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south})))`;
    }

    beforeAll(async () => {
      await db.insert(municipalities).values([
        { id: municipalityId, name: "Test municipality" },
        { id: otherMunicipalityId, name: "Other municipality" },
        {
          id: insideMunicipalityId,
          name: "Synthetic inside",
          boundary: square(0, 0),
        },
        {
          id: adjacentMunicipalityId,
          name: "Synthetic adjacent",
          boundary: square(1, 1),
        },
      ]);
      await db.insert(categories).values({
        id: consultationCategoryId,
        kind: "consultation",
        name: `Synthetic cases ${prefix}`,
      });
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
          residencyVerifiedAt: new Date(),
        },
        {
          userId: moderatorId,
          displayName: "Reviewer",
          municipalityId,
          staffRole: "moderator",
          staffMunicipalityId: municipalityId,
        },
      ]);
      const profiles = await db
        .select()
        .from(memberProfiles)
        .where(
          sql`${memberProfiles.userId} in (${applicantId}, ${moderatorId})`,
        );
      const asViewer = (id: string) => {
        const viewer = toViewer(
          id,
          profiles.find((profile) => profile.userId === id),
          { image: null, contactVerified: true },
        );
        if (viewer.kind !== "member") throw new Error("Fixture missing");
        return viewer;
      };
      moderator = requireModerator(asViewer(moderatorId));
      applicant = asViewer(applicantId);
    });
    afterAll(async () => {
      await db
        .delete(memberProfiles)
        .where(
          sql`${memberProfiles.userId} in (${applicantId}, ${moderatorId})`,
        );
      await db
        .delete(user)
        .where(sql`${user.id} in (${applicantId}, ${moderatorId})`);
      await db
        .delete(categories)
        .where(eq(categories.id, consultationCategoryId));
      await db
        .delete(municipalities)
        .where(
          sql`${municipalities.id} in (${municipalityId}, ${otherMunicipalityId}, ${insideMunicipalityId}, ${adjacentMunicipalityId})`,
        );
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
        messageKey: "notifications.routeReviewed",
        channels: { push: true, email: true },
      };
      await notify(input);
      await notify(input);
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.dedupeKey, prefix));
      expect(rows).toHaveLength(1);
      expect(await drainOutbox()).toBeGreaterThanOrEqual(2);
      const delivered = await db
        .select()
        .from(jobOutbox)
        .where(sql`${jobOutbox.data}->>'notificationId' = ${rows[0]?.id}`);
      // One job per channel, so retrying a failed push never resends the email.
      expect(
        delivered.map((job) => [job.data.push, job.data.email]).sort(),
      ).toEqual([
        [false, true],
        [true, false],
      ]);
      expect(delivered.every((job) => job.processedAt instanceof Date)).toBe(
        true,
      );
      expect(await drainOutbox()).toBe(0);
    });
    test("identical concurrent profile updates commit once", async () => {
      const input = {
        requestId: crypto.randomUUID(),
        displayName: "Applicant Updated",
        municipalityId,
      };
      const results = await Promise.allSettled([
        updateProfile(applicant, input),
        updateProfile(applicant, input),
      ]);
      expect(results.every((result) => result.status === "fulfilled")).toBe(
        true,
      );
      const audits = await db
        .select()
        .from(auditEvents)
        .where(
          sql`${auditEvents.subjectId} = ${applicantId} and ${auditEvents.action} = 'member.profile_updated'`,
        );
      expect(audits).toHaveLength(1);
      await expect(
        updateProfile(applicant, { ...input, displayName: "Different" }),
      ).rejects.toThrow();
    });

    test("a moderator changing their own municipality keeps staff jurisdiction", async () => {
      await updateProfile(moderator, {
        requestId: crypto.randomUUID(),
        displayName: "Reviewer",
        municipalityId: otherMunicipalityId,
      });
      const [profile] = await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, moderatorId));
      expect(profile?.municipalityId).toBe(otherMunicipalityId);
      expect(profile?.staffMunicipalityId).toBe(municipalityId);
    });

    test("the resident badge is staff-scoped, never self-granted, and cleared by a move", async () => {
      await expect(
        setResidencyVerified(moderator, {
          requestId: crypto.randomUUID(),
          userId: moderatorId,
          municipalityId,
          verified: true,
          reason: "Checked in person at the office.",
        }),
      ).rejects.toThrow();
      await expect(
        setResidencyVerified(
          { ...moderator, scope: [`${prefix}-outside`] },
          {
            requestId: crypto.randomUUID(),
            userId: applicantId,
            municipalityId,
            verified: false,
            reason: "Checked in person at the office.",
          },
        ),
      ).rejects.toThrow();

      await updateProfile(applicant, {
        requestId: crypto.randomUUID(),
        displayName: "Applicant Updated",
        municipalityId: null,
      });
      const [profile] = await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, applicantId));
      expect(profile?.residencyVerifiedAt).toBeNull();
    });

    test("a case whose point lies in another municipality is refused without side effects", async () => {
      const title = `Mismatch ${prefix}`;
      const error = await openConsultation(applicant, {
        requestId: crypto.randomUUID(),
        categoryId: consultationCategoryId,
        title,
        body: "A case body long enough to pass the forty character minimum.",
        municipalityId: adjacentMunicipalityId,
        location: { lng: 0.005, lat: 0.005 },
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ConsultationError);
      expect((error as ConsultationError).reason).toBe("municipality_mismatch");
      expect((error as ConsultationError).pointMunicipalityId).toBe(
        insideMunicipalityId,
      );
      const created = await db
        .select({ id: consultations.id })
        .from(consultations)
        .where(eq(consultations.title, title));
      expect(created).toHaveLength(0);
      const audits = await db
        .select()
        .from(auditEvents)
        .where(
          sql`${auditEvents.actorUserId} = ${applicantId} and ${auditEvents.action} = 'consultation.opened'`,
        );
      expect(audits).toHaveLength(0);
    });
  },
);
