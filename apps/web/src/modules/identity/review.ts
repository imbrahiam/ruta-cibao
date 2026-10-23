/**
 * The municipality's side: looking at a request and deciding it.
 *
 * Scoped like every other queue on the desk. A moderator sees and decides
 * only requests for their own municipality; an admin sees the province. Nobody
 * decides their own request — the desk is staffed by residents, and a
 * moderator who is still a visitor cannot be one (`requireModerator` needs a
 * verified cédula), but an admin re-verifying would otherwise approve
 * themselves.
 *
 * The photos are deleted the moment a decision is made. What remains is the
 * decision, who made it, and the reason — which is what an audit asks for.
 */
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { identityReviews, memberProfiles, municipalities } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import {
  canModerate,
  type ModeratorViewer,
} from "@/modules/access/permissions";
import { firstName } from "@/modules/citizen/verify-cedula";
import { notify } from "@/modules/notifications/notify";
import {
  type DecideReviewInput,
  type IdentityDocumentKind,
  IdentityError,
  type ReviewSummary,
} from "./contracts";
import { purgeDocuments, readDocument } from "./documents";
import { displayNameFromRegistry } from "./stage";

function scopeFilter(moderator: ModeratorViewer) {
  return moderator.scope === "all"
    ? undefined
    : inArray(identityReviews.municipalityId, [...moderator.scope]);
}

export async function listReviews(
  moderator: ModeratorViewer,
  input: { status: "pending" | "decided"; limit: number },
): Promise<ReviewSummary[]> {
  const rejectedBefore = sql<number>`(
    select count(*)::int from ${identityReviews} as earlier
    where earlier.user_id = ${identityReviews.userId}
      and earlier.status = 'rejected'
      and earlier.submitted_at < ${identityReviews.submittedAt}
  )`;

  const rows = await db
    .select({
      id: identityReviews.id,
      status: identityReviews.status,
      registryName: memberProfiles.verifiedFullName,
      displayName: memberProfiles.displayName,
      municipalityId: identityReviews.municipalityId,
      municipalityName: municipalities.name,
      submittedAt: identityReviews.submittedAt,
      reviewedAt: identityReviews.reviewedAt,
      reason: identityReviews.reason,
      residenceKey: identityReviews.residenceKey,
      documentsPurgedAt: identityReviews.documentsPurgedAt,
      previousRejections: rejectedBefore,
    })
    .from(identityReviews)
    .innerJoin(
      memberProfiles,
      eq(memberProfiles.userId, identityReviews.userId),
    )
    .innerJoin(
      municipalities,
      eq(municipalities.id, identityReviews.municipalityId),
    )
    .where(
      and(
        input.status === "pending"
          ? eq(identityReviews.status, "pending")
          : ne(identityReviews.status, "pending"),
        ne(identityReviews.userId, moderator.userId),
        scopeFilter(moderator),
      ),
    )
    // Oldest first while waiting — first come, first served — and newest
    // first once decided, which is the order anyone checking history wants.
    .orderBy(
      input.status === "pending"
        ? asc(identityReviews.submittedAt)
        : desc(identityReviews.reviewedAt),
    )
    .limit(input.limit);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    registryName: row.registryName,
    displayName: row.displayName,
    municipalityId: row.municipalityId,
    municipalityName: row.municipalityName,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reason: row.reason,
    hasResidence: row.residenceKey !== null,
    documentsAvailable: row.documentsPurgedAt === null,
    previousRejections: row.previousRejections,
  }));
}

export async function countPendingReviews(
  moderator: ModeratorViewer,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(identityReviews)
    .where(
      and(
        eq(identityReviews.status, "pending"),
        ne(identityReviews.userId, moderator.userId),
        scopeFilter(moderator),
      ),
    );
  return row?.count ?? 0;
}

async function loadReview(moderator: ModeratorViewer, reviewId: string) {
  const [review] = await db
    .select()
    .from(identityReviews)
    .where(eq(identityReviews.id, reviewId))
    .limit(1);

  // Out of scope reads as missing: confirming that a request exists in
  // another municipality is already telling somebody something.
  if (!review || !canModerate(moderator, review.municipalityId)) {
    throw new IdentityError("not_found");
  }
  if (review.userId === moderator.userId) {
    throw new IdentityError("own_request");
  }
  return review;
}

/**
 * One photo, decrypted, for the reviewer's screen. Every view is written to
 * the audit log: looking at somebody's cédula is an act, not a page load.
 */
export async function reviewDocument(
  moderator: ModeratorViewer,
  reviewId: string,
  kind: IdentityDocumentKind,
): Promise<Uint8Array> {
  const review = await loadReview(moderator, reviewId);
  const key =
    kind === "front"
      ? review.frontKey
      : kind === "selfie"
        ? review.selfieKey
        : review.residenceKey;
  if (!key || review.documentsPurgedAt) throw new IdentityError("not_found");

  const bytes = await readDocument(key);
  await recordAudit({
    actorUserId: moderator.userId,
    action: "identity_review.document_viewed",
    subjectType: "identity_review",
    subjectId: review.id,
    municipalityId: review.municipalityId,
    metadata: { kind },
  });
  return bytes;
}

export async function decideReview(
  moderator: ModeratorViewer,
  input: DecideReviewInput,
): Promise<{ status: "approved" | "rejected" }> {
  const review = await loadReview(moderator, input.reviewId);
  if (review.status !== "pending") throw new IdentityError("not_pending");

  const [profile] = await db
    .select({
      id: memberProfiles.id,
      verifiedFullName: memberProfiles.verifiedFullName,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, review.userId))
    .limit(1);
  if (!profile) throw new IdentityError("not_found");

  const now = new Date();

  if (input.decision === "approve") {
    if (review.documentsPurgedAt) throw new IdentityError("not_found");
    // The registry's name is what the photos were compared against. Without
    // it there is nothing to approve yet; the retry job is still working.
    const registryName = profile.verifiedFullName;
    if (!registryName) throw new IdentityError("registry_pending");

    const municipalityId = input.municipalityId ?? review.municipalityId;
    if (!canModerate(moderator, municipalityId)) {
      throw new IdentityError("out_of_scope");
    }

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(identityReviews)
        .set({
          status: "approved",
          reviewedAt: now,
          reviewedByUserId: moderator.userId,
          municipalityId,
        })
        .where(
          and(
            eq(identityReviews.id, review.id),
            eq(identityReviews.status, "pending"),
          ),
        )
        .returning({ id: identityReviews.id });
      // Two reviewers on the same request: the second one loses cleanly.
      if (updated.length === 0) throw new IdentityError("not_pending");

      await tx
        .update(memberProfiles)
        .set({
          tier: "citizen",
          cedulaStatus: "verified",
          verifiedAt: now,
          municipalityId,
          displayName: displayNameFromRegistry(registryName),
        })
        .where(eq(memberProfiles.userId, review.userId));

      await recordAudit(
        {
          actorUserId: moderator.userId,
          action: "identity_review.approved",
          subjectType: "identity_review",
          subjectId: review.id,
          municipalityId,
          metadata: {
            municipalityCorrected: municipalityId !== review.municipalityId,
          },
        },
        tx,
      );
      await notify(
        {
          dedupeKey: `identity:${review.id}:approved`,
          userId: review.userId,
          messageKey: "notifications.cedulaVerified",
          params: { name: firstName(registryName) },
          href: "/cuenta",
          channels: { push: true, email: true },
        },
        tx,
      );
    });

    if (!review.documentsPurgedAt)
      await finish(review).catch(() =>
        console.error("identity deletion deferred to cleanup", {
          reviewId: review.id,
        }),
      );

    return { status: "approved" };
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(identityReviews)
      .set({
        status: "rejected",
        reviewedAt: now,
        reviewedByUserId: moderator.userId,
        reason: input.reason,
        note: input.note || null,
      })
      .where(
        and(
          eq(identityReviews.id, review.id),
          eq(identityReviews.status, "pending"),
        ),
      )
      .returning({ id: identityReviews.id });
    if (updated.length === 0) throw new IdentityError("not_pending");

    // Back to the photo step, cédula kept: nearly every refusal is a photo
    // that can be retaken, and making the person re-enter the number would
    // spend registry quota for nothing.
    await tx
      .update(memberProfiles)
      .set({
        cedulaStatus: profile.verifiedFullName ? "matched" : "pending",
        // A fresh window to retake the photos before the hold lapses.
        cedulaClaimedAt: new Date(),
      })
      .where(eq(memberProfiles.userId, review.userId));

    await recordAudit(
      {
        actorUserId: moderator.userId,
        action: "identity_review.rejected",
        subjectType: "identity_review",
        subjectId: review.id,
        municipalityId: review.municipalityId,
        metadata: { reason: input.reason, note: Boolean(input.note) },
      },
      tx,
    );
    await notify(
      {
        dedupeKey: `identity:${review.id}:rejected`,
        userId: review.userId,
        messageKey: "notifications.identityRejected",
        href: "/verificar",
        channels: { push: true, email: true },
      },
      tx,
    );
  });

  if (!review.documentsPurgedAt)
    await finish(review).catch(() =>
      console.error("identity deletion deferred to cleanup", {
        reviewId: review.id,
      }),
    );

  return { status: "rejected" };
}

/** The photos have done their job. */
async function finish(review: {
  id: string;
  frontKey: string;
  selfieKey: string;
  residenceKey: string | null;
}): Promise<void> {
  await purgeDocuments([
    review.frontKey,
    review.selfieKey,
    review.residenceKey,
  ]);
  await db.transaction(async (tx) => {
    await tx
      .update(identityReviews)
      .set({ documentsPurgedAt: new Date() })
      .where(eq(identityReviews.id, review.id));
    await recordAudit(
      {
        action: "identity_review.documents_purged",
        subjectType: "identity_review",
        subjectId: review.id,
      },
      tx,
    );
  });
}
