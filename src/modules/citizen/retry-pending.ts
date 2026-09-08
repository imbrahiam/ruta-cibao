import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { decryptSensitive } from "@/lib/crypto";
import { lookupCedula, parseCedula } from "@/lib/jce";
import { consumeRateLimit } from "@/lib/rate-limit";
import { notifyVerified } from "./verify-cedula";

/**
 * Finishing the verifications the registry could not answer live.
 *
 * This is the other half of the promise `verifyCedula` makes when the civil
 * registry is down or the hourly quota is spent: the profile parks at
 * `pending`, and something comes back for it. Without this job that promise is
 * a lie, and a resident who tried to verify during an outage stays a visitor
 * forever with no way to notice.
 *
 * Two things shape how it runs, and both are the registry's rules rather than
 * ours. It allows **50 uncached lookups per rolling hour across every API key**,
 * so this takes a deliberately small bite each time and leaves the rest for
 * people verifying live — somebody watching a spinner beats somebody who has
 * closed the tab. And a lookup that fails again is left exactly as it was, to
 * be picked up next time, rather than being marked rejected: "the government
 * service was down" and "this cédula does not exist" are different facts and
 * must not collapse into one.
 */

/** Oldest first, and few: the live path has first call on the quota. */
const BATCH_SIZE = 8;

const RETRY_POLICY = {
  scope: "jce-lookup-retry",
  limit: 12,
  windowMs: 60 * 60 * 1_000,
};

export type RetryOutcome = {
  attempted: number;
  verified: number;
  rejected: number;
  deferred: number;
};

export async function retryPendingVerifications(): Promise<RetryOutcome> {
  const pending = await db
    .select({
      userId: memberProfiles.userId,
      profileId: memberProfiles.id,
      municipalityId: memberProfiles.municipalityId,
      cedulaCiphertext: memberProfiles.cedulaCiphertext,
    })
    .from(memberProfiles)
    .where(
      and(
        eq(memberProfiles.cedulaStatus, "pending"),
        // A profile parked without a stored cédula has nothing to retry with.
        // It cannot happen through `markPending`, and if it ever does, silently
        // skipping it beats throwing on every run forever.
        isNotNull(memberProfiles.cedulaCiphertext),
      ),
    )
    .orderBy(asc(memberProfiles.updatedAt))
    .limit(BATCH_SIZE);

  const outcome: RetryOutcome = {
    attempted: 0,
    verified: 0,
    rejected: 0,
    deferred: 0,
  };

  for (const profile of pending) {
    const budget = await consumeRateLimit("all", RETRY_POLICY);
    if (!budget.allowed) {
      // Out of the slice this job is allowed. The rest stay pending and the
      // next run starts with them, because the order is oldest-first.
      outcome.deferred += pending.length - outcome.attempted;
      break;
    }

    outcome.attempted += 1;

    const cedula = parseCedula(
      decryptSensitive(profile.cedulaCiphertext as string),
    );
    // A stored value that no longer parses is corruption, not a registry
    // problem. Leave it pending and let it surface in the log rather than
    // sending a malformed number to a government API.
    if (!cedula.success) {
      console.error("stored cédula failed to parse", {
        profileId: profile.profileId,
      });
      outcome.deferred += 1;
      continue;
    }

    const lookup = await lookupCedula(cedula.data);

    if (lookup.status === "unavailable") {
      outcome.deferred += 1;
      continue;
    }

    if (lookup.status === "not_found") {
      await db
        .update(memberProfiles)
        .set({ cedulaStatus: "rejected" })
        .where(eq(memberProfiles.userId, profile.userId));

      await recordAudit({
        actorUserId: null,
        action: "member.cedula_rejected",
        subjectType: "member_profile",
        subjectId: profile.profileId,
        metadata: { source: "retry" },
      });

      outcome.rejected += 1;
      continue;
    }

    await db
      .update(memberProfiles)
      .set({
        tier: "citizen",
        cedulaStatus: "verified",
        verifiedFullName: lookup.fullName,
        verifiedAt: new Date(),
        displayName: lookup.fullName,
      })
      .where(eq(memberProfiles.userId, profile.userId));

    await recordAudit({
      actorUserId: null,
      action: "member.cedula_verified",
      subjectType: "member_profile",
      subjectId: profile.profileId,
      municipalityId: profile.municipalityId,
      metadata: { source: "retry" },
    });

    // This is the case the notification exists for: nobody is watching a
    // screen, and without a message the resident never learns they can vote.
    await notifyVerified(profile.userId, lookup.fullName);

    outcome.verified += 1;
  }

  return outcome;
}
