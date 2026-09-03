/**
 * Turning a visitor into a verified citizen.
 *
 * Three constraints shape this, and they are all external:
 *
 *  1. The registry allows **50 uncached lookups per rolling hour, shared
 *     globally across every API key**. So we spend that budget deliberately:
 *     an already-verified profile is never re-checked, and both a per-account
 *     and a platform-wide limiter sit in front of the call.
 *  2. The registry goes down. A failure parks the profile at `pending` for a
 *     retry job instead of turning a resident away — losing an afternoon of
 *     verifications is recoverable, telling citizens the platform is broken is
 *     not.
 *  3. A lookup proves the cédula exists, not that the person typing it owns it.
 *     It is one signal among several, and the unique index on the blind index
 *     is what actually enforces one account per cédula.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { encryptSensitive, hashLookup } from "@/lib/crypto";
import { type Cedula, lookupCedula } from "@/lib/jce";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { MemberViewer } from "@/modules/access/viewer";
import type { VerifyCedulaInput } from "./contracts";

/** Namespace for the cédula blind index. Changing it orphans every existing row. */
const CEDULA_NAMESPACE = "member-cedula";

/**
 * Deliberately below the registry's 50/hour. The headroom is what keeps a burst
 * of sign-ups from spending the whole platform's budget in ten minutes.
 */
const PLATFORM_POLICY = {
  scope: "jce-lookup-platform",
  limit: 35,
  windowMs: 60 * 60 * 1_000,
};
const ACCOUNT_POLICY = {
  scope: "jce-lookup-account",
  limit: 5,
  windowMs: 24 * 60 * 60 * 1_000,
};

export type VerifyCedulaResult = {
  status: "verified" | "pending" | "rejected" | "taken";
  fullName: string | null;
  retryAfterSeconds: number | null;
};

export async function verifyCedula(
  viewer: MemberViewer,
  input: VerifyCedulaInput,
): Promise<VerifyCedulaResult> {
  // Already done. Answering from the stored name costs no quota.
  if (viewer.kind === "citizen") {
    return {
      status: "verified",
      fullName: viewer.profile.verifiedFullName,
      retryAfterSeconds: null,
    };
  }

  const cedula = input.cedula;
  const blindIndex = hashLookup(CEDULA_NAMESPACE, cedula);

  // One cédula, one account. Checked before spending a lookup, since a
  // duplicate needs no help from the registry to be rejected.
  const [existing] = await db
    .select({ userId: memberProfiles.userId })
    .from(memberProfiles)
    .where(eq(memberProfiles.cedulaBlindIndex, blindIndex))
    .limit(1);

  if (existing && existing.userId !== viewer.userId) {
    await recordAudit({
      actorUserId: viewer.userId,
      action: "member.cedula_already_registered",
      subjectType: "member_profile",
      subjectId: viewer.profile.id,
    });
    return { status: "taken", fullName: null, retryAfterSeconds: null };
  }

  const account = await consumeRateLimit(viewer.userId, ACCOUNT_POLICY);
  if (!account.allowed) {
    return {
      status: "pending",
      fullName: null,
      retryAfterSeconds: account.retryAfterSeconds,
    };
  }

  const platform = await consumeRateLimit("all", PLATFORM_POLICY);
  if (!platform.allowed) {
    await markPending(viewer, blindIndex, cedula, input.municipalityId);
    return {
      status: "pending",
      fullName: null,
      retryAfterSeconds: platform.retryAfterSeconds,
    };
  }

  const lookup = await lookupCedula(cedula);

  if (lookup.status === "unavailable") {
    await markPending(viewer, blindIndex, cedula, input.municipalityId);
    await recordAudit({
      actorUserId: viewer.userId,
      action: "member.cedula_verification_deferred",
      subjectType: "member_profile",
      subjectId: viewer.profile.id,
      metadata: { reason: lookup.reason },
    });
    return {
      status: "pending",
      fullName: null,
      retryAfterSeconds: lookup.retryAfter
        ? Math.ceil((lookup.retryAfter.getTime() - Date.now()) / 1_000)
        : null,
    };
  }

  if (lookup.status === "not_found") {
    await db
      .update(memberProfiles)
      .set({ cedulaStatus: "rejected" })
      .where(eq(memberProfiles.userId, viewer.userId));

    await recordAudit({
      actorUserId: viewer.userId,
      action: "member.cedula_rejected",
      subjectType: "member_profile",
      subjectId: viewer.profile.id,
    });
    return { status: "rejected", fullName: null, retryAfterSeconds: null };
  }

  await db
    .update(memberProfiles)
    .set({
      tier: "citizen",
      cedulaCiphertext: encryptSensitive(cedula),
      cedulaBlindIndex: blindIndex,
      cedulaStatus: "verified",
      verifiedFullName: lookup.fullName,
      verifiedAt: new Date(),
      municipalityId: input.municipalityId,
      // The registry's name is the authoritative one for a resident.
      displayName: lookup.fullName,
    })
    .where(eq(memberProfiles.userId, viewer.userId));

  await recordAudit({
    actorUserId: viewer.userId,
    action: "member.cedula_verified",
    subjectType: "member_profile",
    subjectId: viewer.profile.id,
    municipalityId: input.municipalityId,
  });

  return {
    status: "verified",
    fullName: lookup.fullName,
    retryAfterSeconds: null,
  };
}

/**
 * Parks the profile so a retry job can finish the job later.
 *
 * The cédula is stored encrypted even though it is unverified: the retry needs
 * it, and keeping it in plaintext anywhere — a queue payload, a log line —
 * would be the one place this data leaks from.
 */
async function markPending(
  viewer: MemberViewer,
  blindIndex: string,
  cedula: Cedula,
  municipalityId: string,
): Promise<void> {
  await db
    .update(memberProfiles)
    .set({
      cedulaCiphertext: encryptSensitive(cedula),
      cedulaBlindIndex: blindIndex,
      cedulaStatus: "pending",
      municipalityId,
    })
    .where(eq(memberProfiles.userId, viewer.userId));
}
