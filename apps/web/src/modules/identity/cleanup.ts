import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { identityReviews, memberProfiles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { notify } from "@/modules/notifications/notify";
import { purgeDocuments } from "./documents";

export const IDENTITY_RETENTION_DAYS = 30;

/** Retry failed deletions and close requests that exceeded evidence retention. */
export async function cleanupIdentityDocuments(): Promise<number> {
  const rows = await db
    .select()
    .from(identityReviews)
    .where(
      and(
        isNull(identityReviews.documentsPurgedAt),
        or(
          ne(identityReviews.status, "pending"),
          sql`${identityReviews.submittedAt} < now() - ${IDENTITY_RETENTION_DAYS} * interval '1 day'`,
        ),
      ),
    )
    .limit(50);
  let purged = 0;
  for (const row of rows) {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(identityReviews)
        .where(eq(identityReviews.id, row.id))
        .limit(1)
        .for("update");
      if (current?.status !== "pending") return;
      await tx
        .update(identityReviews)
        .set({
          status: "rejected",
          reason: "incomplete",
          reviewedAt: new Date(),
        })
        .where(eq(identityReviews.id, row.id));
      const [profile] = await tx
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, current.userId))
        .limit(1);
      await tx
        .update(memberProfiles)
        .set({
          cedulaStatus: profile?.verifiedFullName ? "matched" : "pending",
          cedulaClaimedAt: new Date(),
        })
        .where(eq(memberProfiles.userId, current.userId));
      await recordAudit(
        {
          action: "identity_review.expired",
          subjectType: "identity_review",
          subjectId: current.id,
          municipalityId: current.municipalityId,
        },
        tx,
      );
      await notify(
        {
          dedupeKey: `identity:${current.id}:expired`,
          userId: current.userId,
          messageKey: "notifications.identityExpired",
          href: "/verificar",
          channels: { push: true, email: true },
        },
        tx,
      );
    });
    try {
      await purgeDocuments([row.frontKey, row.selfieKey, row.residenceKey]);
      await db.transaction(async (tx) => {
        await tx
          .update(identityReviews)
          .set({ documentsPurgedAt: new Date() })
          .where(
            and(
              eq(identityReviews.id, row.id),
              isNull(identityReviews.documentsPurgedAt),
            ),
          );
        await recordAudit(
          {
            action: "identity_review.documents_purged",
            subjectType: "identity_review",
            subjectId: row.id,
            municipalityId: row.municipalityId,
          },
          tx,
        );
      });
      purged++;
    } catch {
      console.error("identity document deletion failed; cleanup will retry", {
        reviewId: row.id,
      });
    }
  }
  return purged;
}
