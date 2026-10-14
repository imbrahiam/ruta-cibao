/**
 * Sending the photos: the second step of becoming a verified resident.
 *
 * The cédula has to be on file first — found by the registry, or still
 * waiting for it; a person is not held up by the registry being down. What is
 * created here is a request the municipality answers, and nothing about the
 * account's powers changes until it does.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { identityReviews, jobOutbox, memberProfiles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { QUEUES } from "@/lib/jobs/queues";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { MemberViewer } from "@/modules/access/viewer";
import { notify } from "@/modules/notifications/notify";
import { IdentityError } from "./contracts";
import {
  assertDocument,
  documentKey,
  purgeDocuments,
  storeDocument,
} from "./documents";

/** A few attempts a day: enough to retake a blurry photo, not to spam a desk. */
const SUBMIT_POLICY = {
  scope: "identity-submit",
  limit: 5,
  windowMs: 24 * 60 * 60 * 1_000,
};

export type IdentitySubmission = {
  front: Uint8Array | null;
  selfie: Uint8Array | null;
  residence: Uint8Array | null;
};

export async function submitIdentityReview(
  viewer: MemberViewer,
  files: IdentitySubmission,
): Promise<{ reviewId: string }> {
  if (viewer.kind === "citizen") throw new IdentityError("already_verified");

  const profile = viewer.profile;
  if (profile.cedulaStatus === "in_review") {
    throw new IdentityError("already_submitted");
  }
  if (
    (profile.cedulaStatus !== "matched" &&
      profile.cedulaStatus !== "pending") ||
    !profile.cedulaCiphertext ||
    !profile.municipalityId
  ) {
    throw new IdentityError("cedula_required");
  }

  // Checked before anything is stored or counted: a wrong file is the
  // person's mistake to fix, not an attempt.
  assertDocument("front", files.front);
  assertDocument("selfie", files.selfie);
  if (files.residence && files.residence.byteLength > 0) {
    assertDocument("residence", files.residence);
  }

  const budget = await consumeRateLimit(viewer.userId, SUBMIT_POLICY);
  if (!budget.allowed) throw new IdentityError("too_many");

  const reviewId = randomUUID();
  const keys = {
    front: documentKey(viewer.userId, reviewId, "front"),
    selfie: documentKey(viewer.userId, reviewId, "selfie"),
    residence:
      files.residence && files.residence.byteLength > 0
        ? documentKey(viewer.userId, reviewId, "residence")
        : null,
  };

  // Persist cleanup before writing objects: a killed request must not leave
  // encrypted evidence outside the retention process. The delayed handler
  // preserves every object belonging to a committed review.
  await db.transaction(async (tx) => {
    await tx.insert(jobOutbox).values({
      queue: QUEUES.identityDiscardUploads,
      data: { userId: viewer.userId, reviewId },
      nextAttemptAt: new Date(Date.now() + 3_600_000),
    });
    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: "identity_review.upload_reserved",
        subjectType: "identity_review",
        subjectId: reviewId,
      },
      tx,
    );
  });

  const uploads = await Promise.allSettled([
    storeDocument(keys.front, files.front),
    storeDocument(keys.selfie, files.selfie),
    ...(keys.residence && files.residence
      ? [storeDocument(keys.residence, files.residence)]
      : []),
  ]);
  if (uploads.some((result) => result.status === "rejected")) {
    await purgeDocuments([keys.front, keys.selfie, keys.residence]).catch(() =>
      console.error("identity upload cleanup requires retry"),
    );
    throw new Error("Identity document storage unavailable");
  }

  const municipalityId = profile.municipalityId;
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, viewer.userId))
        .limit(1)
        .for("update");
      if (!current || current.cedulaStatus === "in_review")
        throw new IdentityError("already_submitted");
      if (current.tier === "citizen")
        throw new IdentityError("already_verified");
      if (
        (current.cedulaStatus !== "matched" &&
          current.cedulaStatus !== "pending") ||
        current.cedulaBlindIndex !== profile.cedulaBlindIndex ||
        current.municipalityId !== municipalityId
      )
        throw new IdentityError("cedula_required");
      await tx.insert(identityReviews).values({
        id: reviewId,
        userId: viewer.userId,
        municipalityId,
        frontKey: keys.front,
        selfieKey: keys.selfie,
        residenceKey: keys.residence,
      });
      await tx
        .update(memberProfiles)
        .set({ cedulaStatus: "in_review" })
        .where(eq(memberProfiles.userId, viewer.userId));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "identity_review.submitted",
          subjectType: "identity_review",
          subjectId: reviewId,
          municipalityId,
          metadata: { residence: keys.residence !== null },
        },
        tx,
      );
      await notify(
        {
          dedupeKey: `identity:${reviewId}:submitted`,
          userId: viewer.userId,
          messageKey: "notifications.identitySubmitted",
          href: "/verificar",
          channels: { push: false, email: false },
        },
        tx,
      );
    });
  } catch (error) {
    // Most likely a second tab that got there first (one open request per
    // person). Either way these photos belong to no row now.
    await purgeDocuments([keys.front, keys.selfie, keys.residence]).catch(() =>
      console.error("identity upload cleanup requires retry"),
    );
    if (isUniqueViolation(error)) throw new IdentityError("already_submitted");
    throw error;
  }

  return { reviewId };
}

function isUniqueViolation(error: unknown): boolean {
  const code =
    (error as { code?: string })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

/**
 * "That is not my name": back to the cédula step.
 *
 * The registry answered for the number that was typed, so a typo shows a
 * stranger's name. Clearing the stored cédula (and its blind index, which
 * frees the number for its owner) is the only fix. Not offered once the
 * photos are with the municipality — they were taken of this cédula.
 */
export async function restartCedula(viewer: MemberViewer): Promise<void> {
  if (viewer.kind === "citizen") throw new IdentityError("already_verified");
  const status = viewer.profile.cedulaStatus;
  if (status === "in_review") throw new IdentityError("already_submitted");
  if (status !== "matched" && status !== "pending" && status !== "rejected") {
    return;
  }

  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, viewer.userId))
      .limit(1)
      .for("update");
    if (!current) throw new IdentityError("not_found");
    if (current.tier === "citizen") throw new IdentityError("already_verified");
    if (current.cedulaStatus === "in_review")
      throw new IdentityError("already_submitted");
    await tx
      .update(memberProfiles)
      .set({
        cedulaStatus: "none",
        cedulaCiphertext: null,
        cedulaBlindIndex: null,
        cedulaClaimedAt: null,
        verifiedFullName: null,
        claimedName: null,
      })
      .where(eq(memberProfiles.userId, viewer.userId));
    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: "member.cedula_cleared",
        subjectType: "member_profile",
        subjectId: viewer.profile.id,
      },
      tx,
    );
  });
}

/** Delayed cleanup for requests that never committed a review. */
export async function discardIdentityUploads(input: {
  userId: string;
  reviewId: string;
}): Promise<void> {
  const [review] = await db
    .select({ id: identityReviews.id })
    .from(identityReviews)
    .where(eq(identityReviews.id, input.reviewId))
    .limit(1);
  if (review) return;
  await purgeDocuments(
    ["front", "selfie", "residence"].map((kind) =>
      documentKey(
        input.userId,
        input.reviewId,
        kind as "front" | "selfie" | "residence",
      ),
    ),
  );
}
