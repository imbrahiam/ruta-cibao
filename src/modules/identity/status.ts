import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { identityReviews, municipalities } from "@/db/schema";
import type { MemberViewer } from "@/modules/access/viewer";
import type { VerificationStatus } from "./contracts";
import { stageOf } from "./stage";

/** Where the caller stands, with what each screen needs to say so. */
export async function verificationStatus(
  viewer: MemberViewer,
): Promise<VerificationStatus> {
  const profile = viewer.profile;

  const [[latest], [municipality]] = await Promise.all([
    db
      .select({
        id: identityReviews.id,
        status: identityReviews.status,
        submittedAt: identityReviews.submittedAt,
        reviewedAt: identityReviews.reviewedAt,
        reason: identityReviews.reason,
        note: identityReviews.note,
      })
      .from(identityReviews)
      .where(eq(identityReviews.userId, viewer.userId))
      .orderBy(desc(identityReviews.submittedAt))
      .limit(1),
    profile.municipalityId
      ? db
          .select({ id: municipalities.id, name: municipalities.name })
          .from(municipalities)
          .where(eq(municipalities.id, profile.municipalityId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    stage: stageOf(profile.cedulaStatus, profile.tier, latest?.status ?? null),
    cedulaStatus: profile.cedulaStatus,
    registryName: profile.verifiedFullName,
    municipality: municipality ?? null,
    review: latest
      ? {
          id: latest.id,
          status: latest.status,
          submittedAt: latest.submittedAt.toISOString(),
          reviewedAt: latest.reviewedAt?.toISOString() ?? null,
          reason: latest.reason,
          note: latest.note,
        }
      : null,
  };
}
