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
import { memberProfiles, user } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { encryptSensitive, hashLookup } from "@/lib/crypto";
import { type Cedula, lookupCedula } from "@/lib/jce";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { MemberViewer } from "@/modules/access/viewer";
import { notify } from "@/modules/notifications/notify";
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
    await notifyPending(viewer);
    return {
      status: "pending",
      fullName: null,
      retryAfterSeconds: platform.retryAfterSeconds,
    };
  }

  const lookup = await lookupCedula(cedula);

  if (lookup.status === "unavailable") {
    await markPending(viewer, blindIndex, cedula, input.municipalityId);
    await notifyPending(viewer);
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

  // The one notification somebody is genuinely waiting for, and the one this
  // flow never sent. Verification can finish minutes or hours after the form
  // was submitted — a retry job picks up whatever the registry could not answer
  // live — so the person who now has a vote has to be told they have one.
  await notifyVerified(viewer.userId, lookup.fullName);

  return {
    status: "verified",
    fullName: lookup.fullName,
    retryAfterSeconds: null,
  };
}

/**
 * "We are still trying."
 *
 * Sent once per attempt that could not be answered, and deliberately without
 * email or push: the person is almost always still on the verification screen,
 * which already says this. What the notification buys is the record — so
 * somebody who closed the tab and comes back tomorrow can see that the platform
 * did not simply lose their cédula.
 */
async function notifyPending(viewer: MemberViewer): Promise<void> {
  await notify({
    userId: viewer.userId,
    messageKey: "notifications.cedulaPending",
    href: "/verificar",
    channels: { push: false, email: false },
  });
}

/**
 * "You are a verified resident now."
 *
 * The one notification in this flow that is worth an email, which is why the
 * address is looked up rather than assumed: `notify` sends email only when it
 * is given one, so a comment promising a copy without fetching it would have
 * been a comment describing something that never happens.
 *
 * Shared with the retry job, because that is the case the notification really
 * exists for — nobody is watching a screen when the registry finally answers.
 */
export async function notifyVerified(
  userId: string,
  fullName: string,
): Promise<void> {
  const [account] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  await notify({
    userId,
    messageKey: "notifications.cedulaVerified",
    params: { name: firstName(fullName) },
    href: "/cuenta",
    email: account?.email,
    // Becoming a verified resident is a change to the account itself, and this
    // may be arriving long after they closed the tab.
    channels: { push: true, email: true },
  });
}

/**
 * The registry returns a full legal name in capitals. A notification that
 * greets somebody as "MARÍA ALTAGRACIA PÉREZ DE LOS SANTOS" is shouting a
 * stranger's paperwork at them; the first name is what a person is called.
 */
function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? fullName;
  return first.charAt(0) + first.slice(1).toLowerCase();
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
