/**
 * The first of the two checks that make a verified resident: the civil
 * registry.
 *
 * A found cédula no longer makes somebody a citizen on the spot. It proves the
 * number exists and gives the name on it — which is what the municipality then
 * compares a photo of the cédula, and of the person holding it, against
 * (`@/modules/identity`). Only the municipality's approval sets `verified`.
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
 *     So the person types their name too, and the registry's is only ever
 *     confirmed, never revealed. The unique index on the blind index enforces
 *     one account per cédula, and a hold that never reaches the municipality
 *     lapses (`CEDULA_HOLD_MS`) so it cannot lock the owner out.
 */
import { eq } from "drizzle-orm";
import { type Db, type DbTransaction, db } from "@/db";
import { memberProfiles, municipalities, user } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { encryptSensitive, hashLookup } from "@/lib/crypto";
import { lookupCedula } from "@/lib/jce";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { MemberViewer } from "@/modules/access/viewer";
import { notify } from "@/modules/notifications/notify";
import type { VerifyCedulaInput } from "./contracts";
import { cedulaCheckDigitValid, namesMatch } from "./registry-match";

/** Namespace for the cédula blind index. Changing it orphans every existing row. */
const CEDULA_NAMESPACE = "member-cedula";

const ACCOUNT_POLICY = {
  scope: "jce-lookup-account",
  limit: 5,
  windowMs: 24 * 60 * 60 * 1_000,
};

export type VerifyCedulaResult = {
  status:
    | "verified"
    | "matched"
    | "in_review"
    | "pending"
    | "rejected"
    | "taken"
    | "check_digit";
  fullName: string | null;
  retryAfterSeconds: number | null;
};

/**
 * How long a cédula stays reserved to an account that has not sent its
 * photos. Long enough to find the cédula in a drawer and come back; short
 * enough that a number typed by the wrong person frees itself for its owner.
 */
export const CEDULA_HOLD_MS = 72 * 60 * 60 * 1_000;

const REJECTED: VerifyCedulaResult = {
  status: "rejected",
  fullName: null,
  retryAfterSeconds: null,
};

export async function verifyCedula(
  viewer: MemberViewer,
  input: VerifyCedulaInput,
): Promise<VerifyCedulaResult> {
  const [profile] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, viewer.userId))
    .limit(1);
  if (!profile) throw new Error("Member profile missing");
  const settled = resultFromProfile(profile);
  if (settled) return settled;

  // Before anything is counted or spent: a failed check digit is nearly
  // always a typo, and the person gets to look again for free.
  if (!input.confirmNumber && !cedulaCheckDigitValid(input.cedula))
    return { status: "check_digit", fullName: null, retryAfterSeconds: null };

  const [municipality] = await db
    .select({ id: municipalities.id })
    .from(municipalities)
    .where(eq(municipalities.id, input.municipalityId))
    .limit(1);
  if (!municipality) throw new Error("Unknown municipality");

  const blindIndex = hashLookup(CEDULA_NAMESPACE, input.cedula);
  const holder = await currentHolder(blindIndex, viewer.userId);
  if (holder === "held") {
    await recordAudit({
      actorUserId: viewer.userId,
      action: "member.cedula_already_registered",
      subjectType: "member_profile",
      subjectId: profile.id,
    });
    return { status: "taken", fullName: null, retryAfterSeconds: null };
  }

  const account = await consumeRateLimit(viewer.userId, ACCOUNT_POLICY);
  if (!account.allowed)
    return {
      status: "pending",
      fullName: null,
      retryAfterSeconds: account.retryAfterSeconds,
    };
  const lookup = await lookupCedula(input.cedula);

  // Nothing is stored for a number the registry does not know, or knows under
  // another name: the hold would only lock the real owner out.
  if (
    lookup.status === "not_found" ||
    (lookup.status === "found" && !namesMatch(input.name, lookup.fullName))
  ) {
    await recordAudit({
      actorUserId: viewer.userId,
      action:
        lookup.status === "not_found"
          ? "member.cedula_rejected"
          : "member.cedula_name_mismatch",
      subjectType: "member_profile",
      subjectId: profile.id,
    });
    return REJECTED;
  }

  try {
    return await db.transaction(async (tx): Promise<VerifyCedulaResult> => {
      const [current] = await tx
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, viewer.userId))
        .limit(1)
        .for("update");
      if (!current) throw new Error("Member profile missing");
      const currentResult = resultFromProfile(current);
      if (currentResult) return currentResult;
      // Recheck under the holder's row lock: they may have submitted photos
      // or been approved while the registry request was in flight.
      const lockedHolder = await currentHolder(
        blindIndex,
        viewer.userId,
        tx,
        true,
      );
      if (lockedHolder === "held")
        return { status: "taken", fullName: null, retryAfterSeconds: null };
      if (lockedHolder !== "free") await releaseHold(tx, lockedHolder);
      const found = lookup.status === "found";
      const status = found ? "matched" : "pending";
      await tx
        .update(memberProfiles)
        .set({
          cedulaCiphertext: encryptSensitive(input.cedula),
          cedulaBlindIndex: blindIndex,
          cedulaClaimedAt: new Date(),
          cedulaStatus: status,
          verifiedFullName: found ? lookup.fullName : null,
          // Kept only until the registry answers, for the same comparison.
          claimedName: found ? null : input.name,
          municipalityId: input.municipalityId,
        })
        .where(eq(memberProfiles.userId, viewer.userId));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: found
            ? "member.cedula_matched"
            : "member.cedula_verification_deferred",
          subjectType: "member_profile",
          subjectId: current.id,
          municipalityId: input.municipalityId,
        },
        tx,
      );
      if (!found)
        await notify(
          {
            userId: viewer.userId,
            messageKey: "notifications.cedulaPending",
            href: "/verificar",
            channels: { push: false, email: false },
          },
          tx,
        );
      return {
        status,
        fullName: found ? lookup.fullName : null,
        retryAfterSeconds:
          lookup.status === "unavailable" && lookup.retryAfter
            ? Math.max(
                1,
                Math.ceil((lookup.retryAfter.getTime() - Date.now()) / 1000),
              )
            : null,
      };
    });
  } catch (error) {
    const code =
      (error as { code?: string; cause?: { code?: string } }).code ??
      (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23505")
      return { status: "taken", fullName: null, retryAfterSeconds: null };
    throw error;
  }
}

type Holder = "free" | "held" | { userId: string; profileId: string };

/**
 * Who has this cédula, and whether they get to keep it.
 *
 * A verified resident, or somebody whose photos are with the municipality,
 * keeps it: the review is where a dispute is settled, by a person comparing a
 * face to a document. Anybody else keeps it only for `CEDULA_HOLD_MS`.
 */
async function currentHolder(
  blindIndex: string,
  viewerUserId: string,
  executor: Db | DbTransaction = db,
  lock = false,
): Promise<Holder> {
  const query = executor
    .select({
      userId: memberProfiles.userId,
      profileId: memberProfiles.id,
      status: memberProfiles.cedulaStatus,
      claimedAt: memberProfiles.cedulaClaimedAt,
    })
    .from(memberProfiles)
    .where(eq(memberProfiles.cedulaBlindIndex, blindIndex))
    .limit(1);
  const [existing] = await (lock ? query.for("update") : query);
  if (!existing || existing.userId === viewerUserId) return "free";
  const lapsed =
    (existing.status === "matched" ||
      existing.status === "pending" ||
      existing.status === "rejected") &&
    (!existing.claimedAt ||
      Date.now() - existing.claimedAt.getTime() > CEDULA_HOLD_MS);
  return lapsed
    ? { userId: existing.userId, profileId: existing.profileId }
    : "held";
}

/** Frees a lapsed hold, and tells the account that had it. */
async function releaseHold(
  tx: DbTransaction,
  holder: { userId: string; profileId: string },
): Promise<void> {
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
    .where(eq(memberProfiles.userId, holder.userId));
  await recordAudit(
    {
      actorUserId: null,
      action: "member.cedula_hold_lapsed",
      subjectType: "member_profile",
      subjectId: holder.profileId,
    },
    tx,
  );
  await notify(
    {
      userId: holder.userId,
      messageKey: "notifications.cedulaHoldLapsed",
      href: "/verificar",
      channels: { push: true, email: false },
    },
    tx,
  );
}

function resultFromProfile(
  profile: typeof memberProfiles.$inferSelect,
): VerifyCedulaResult | null {
  if (profile.tier === "citizen" && profile.cedulaStatus === "verified")
    return {
      status: "verified",
      fullName: profile.verifiedFullName,
      retryAfterSeconds: null,
    };
  if (
    profile.cedulaStatus === "in_review" ||
    profile.cedulaStatus === "matched" ||
    profile.cedulaStatus === "pending"
  )
    return {
      status: profile.cedulaStatus,
      fullName: profile.verifiedFullName,
      retryAfterSeconds: null,
    };
  return null;
}

/**
 * "You are a verified resident now."
 *
 * The one notification in this flow that is worth an email, which is why the
 * address is looked up rather than assumed: `notify` sends email only when it
 * is given one, so a comment promising a copy without fetching it would have
 * been a comment describing something that never happens.
 *
 * Sent when the municipality approves, which is usually a day or two after
 * the person closed the tab.
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
export function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? fullName;
  return first.charAt(0) + first.slice(1).toLowerCase();
}
