import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { memberProfiles, municipalities } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { assertModerates, type ModeratorViewer } from "./permissions";
import type { MemberViewer } from "./viewer";

export type UpdateProfileInput = {
  requestId: string;
  displayName: string;
  municipalityId: string | null;
};

export type SetResidencyVerifiedInput = {
  requestId: string;
  userId: string;
  municipalityId: string;
  verified: boolean;
  reason: string;
};

/**
 * The person's own editable profile: a display name and the municipality they
 * call theirs.
 *
 * Changing the municipality clears the in-person resident badge, which was
 * granted for the old one. Staff jurisdiction lives in a separate column that
 * this function never touches.
 */
export async function updateProfile(
  viewer: MemberViewer,
  input: UpdateProfileInput,
): Promise<{ status: "ok" }> {
  await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      if (input.municipalityId !== null) {
        const [municipality] = await tx
          .select({ id: municipalities.id })
          .from(municipalities)
          .where(eq(municipalities.id, input.municipalityId))
          .limit(1);
        if (!municipality) {
          throw new ORPCError("BAD_REQUEST", {
            message: "That municipality does not exist.",
            data: { reason: "invalid_municipality" },
          });
        }
      }

      const [current] = await tx
        .select({
          municipalityId: memberProfiles.municipalityId,
          residencyVerifiedAt: memberProfiles.residencyVerifiedAt,
        })
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, viewer.userId))
        .limit(1)
        .for("update");
      if (!current) throw new ORPCError("UNAUTHORIZED");

      const municipalityChanged =
        current.municipalityId !== input.municipalityId;
      const residencyCleared =
        municipalityChanged && current.residencyVerifiedAt !== null;

      await tx
        .update(memberProfiles)
        .set({
          displayName: input.displayName,
          municipalityId: input.municipalityId,
          ...(municipalityChanged
            ? { residencyVerifiedAt: null, residencyVerifiedByUserId: null }
            : {}),
        })
        .where(eq(memberProfiles.userId, viewer.userId));

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "member.profile_updated",
          subjectType: "member",
          subjectId: viewer.userId,
          municipalityId: input.municipalityId,
          metadata: { municipalityChanged, residencyCleared },
        },
        tx,
      );
      return { status: "ok" as const };
    },
  });
  return { status: "ok" };
}

/**
 * Grants or revokes the optional in-person resident badge.
 *
 * Staff act only inside their own jurisdiction, never on themselves, and only
 * for the municipality the person has selected — the badge says "an official
 * met this person and they live here", nothing more. The reason is mandatory
 * and lands in the audit trail.
 */
export async function setResidencyVerified(
  viewer: ModeratorViewer,
  input: SetResidencyVerifiedInput,
): Promise<{ verified: boolean }> {
  assertModerates(viewer, input.municipalityId);
  if (input.userId === viewer.userId) {
    throw new ORPCError("FORBIDDEN", {
      message: "Staff cannot verify themselves.",
      data: { reason: "self_verification" },
    });
  }

  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [subject] = await tx
        .select({ municipalityId: memberProfiles.municipalityId })
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, input.userId))
        .limit(1)
        .for("update");
      if (!subject) {
        throw new ORPCError("NOT_FOUND", {
          message: "That member does not exist.",
          data: { reason: "not_found" },
        });
      }
      if (subject.municipalityId !== input.municipalityId) {
        throw new ORPCError("CONFLICT", {
          message: "The member has selected a different municipality.",
          data: { reason: "municipality_mismatch" },
        });
      }

      await tx
        .update(memberProfiles)
        .set(
          input.verified
            ? {
                residencyVerifiedAt: new Date(),
                residencyVerifiedByUserId: viewer.userId,
              }
            : { residencyVerifiedAt: null, residencyVerifiedByUserId: null },
        )
        .where(eq(memberProfiles.userId, input.userId));

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: input.verified
            ? "member.residency_verified"
            : "member.residency_revoked",
          subjectType: "member",
          subjectId: input.userId,
          municipalityId: input.municipalityId,
          metadata: { reason: input.reason },
        },
        tx,
      );
      return { verified: input.verified };
    },
  });
  return outcome.result;
}
