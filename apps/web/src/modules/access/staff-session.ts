import { ORPCError } from "@orpc/server";
import type { VerifyRecoveryCodeInput, VerifyTotpInput } from "@ruta/contracts";
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { type Db, type DbTransaction, db } from "@/db";
import {
  session,
  staffSessionVerifications,
  twoFactor,
  user,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  consumeRollingRateLimit,
  getRequestClientKey,
  type RateLimitPolicy,
} from "@/lib/rate-limit";
import { requireModerator } from "./permissions";
import type { ResolvedSession } from "./session";

export const STAFF_SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

const USER_STEP_UP_LIMIT: RateLimitPolicy = {
  scope: "staff-step-up-user",
  limit: 8,
  windowMs: 15 * 60_000,
};

const CLIENT_STEP_UP_LIMIT: RateLimitPolicy = {
  scope: "staff-step-up-client",
  limit: 20,
  windowMs: 15 * 60_000,
};

type Executor = Db | DbTransaction;

/**
 * Guarded path so seeded demo moderators (`LOCAL_DEMO_PHONES`) can use staff
 * APIs without TOTP on the synthetic account: on `localhost` in development,
 * or on the hosted demo (`DEMO_DEPLOYMENT`, which env validation only accepts
 * on a `demo.` host).
 *
 * Never active in `test`, never on the real service, and never once an
 * account enrolls two-factor authentication.
 */
export function isLocalDemoStaffBypassAllowed(
  resolved: ResolvedSession,
): boolean {
  if (!env.LOCAL_DEMO_OTP || !env.LOCAL_DEMO_PHONES) return false;
  if (!resolved.contact?.phoneNumber) return false;
  if (resolved.contact.twoFactorEnabled) return false;

  if (!env.DEMO_DEPLOYMENT) {
    if (env.NODE_ENV !== "development") return false;
    try {
      if (new URL(env.APP_URL).hostname !== "localhost") return false;
    } catch {
      return false;
    }
  }

  const demoPhones = new Set(
    env.LOCAL_DEMO_PHONES.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return demoPhones.has(resolved.contact.phoneNumber);
}

async function enforceStepUpRateLimits(
  userId: string,
  headers: Headers,
): Promise<void> {
  const [userAllowance, clientAllowance] = await Promise.all([
    consumeRollingRateLimit(userId, USER_STEP_UP_LIMIT),
    consumeRollingRateLimit(getRequestClientKey(headers), CLIENT_STEP_UP_LIMIT),
  ]);
  if (!userAllowance.allowed || !clientAllowance.allowed) {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many verification attempts. Try again later.",
      data: { reason: "rate_limited" },
    });
  }
}

async function assertTotpEnrolled(userId: string): Promise<void> {
  const [row] = await db
    .select({
      twoFactorEnabled: user.twoFactorEnabled,
      verified: twoFactor.verified,
    })
    .from(user)
    .leftJoin(twoFactor, eq(twoFactor.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);

  if (!row?.twoFactorEnabled || !row?.verified) {
    throw new ORPCError("FORBIDDEN", {
      message: "Two-factor authentication is not enrolled on this account.",
      data: { reason: "totp_enrollment_required" },
    });
  }
}

function mapVerificationFailure(error: unknown): never {
  if (error instanceof ORPCError) throw error;
  if (error && typeof error === "object" && "status" in error) {
    const status = error.status;
    if (status === 429 || status === "TOO_MANY_REQUESTS") {
      throw new ORPCError("TOO_MANY_REQUESTS", {
        message: "Too many failed attempts. Try again later.",
        data: { reason: "rate_limited" },
      });
    }
  }
  throw new ORPCError("UNAUTHORIZED", {
    message: "Invalid verification code.",
    data: { reason: "invalid_code" },
  });
}

async function recordStaffSessionGrant(
  userId: string,
  sessionId: string,
  municipalityId: string | null,
  action:
    | "staff.session_verified_totp"
    | "staff.session_verified_recovery_code",
): Promise<{ verifiedUntil: string }> {
  const verifiedAt = new Date();
  const expiresAt = new Date(verifiedAt.getTime() + STAFF_SESSION_TTL_MS);

  await db.transaction(async (tx) => {
    await tx
      .insert(staffSessionVerifications)
      .values({
        sessionId,
        verifiedAt,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: staffSessionVerifications.sessionId,
        set: {
          verifiedAt,
          expiresAt,
        },
      });

    await recordAudit(
      {
        actorUserId: userId,
        action,
        subjectType: "staff_session",
        subjectId: sessionId,
        municipalityId,
        metadata: { expiresAt: expiresAt.toISOString() },
      },
      tx,
    );
  });

  return { verifiedUntil: expiresAt.toISOString() };
}

export async function verifyStaffTotp(
  headers: Headers,
  resolved: ResolvedSession,
  input: VerifyTotpInput,
): Promise<{ verifiedUntil: string }> {
  const moderator = requireModerator(resolved.viewer);
  if (!resolved.session) throw new ORPCError("UNAUTHORIZED");

  await enforceStepUpRateLimits(moderator.userId, headers);

  if (
    isLocalDemoStaffBypassAllowed(resolved) &&
    input.code === env.LOCAL_DEMO_OTP
  ) {
    return recordStaffSessionGrant(
      moderator.userId,
      resolved.session.id,
      moderator.profile.staffRole === "moderator"
        ? moderator.profile.staffMunicipalityId
        : null,
      "staff.session_verified_totp",
    );
  }

  await assertTotpEnrolled(moderator.userId);

  try {
    await getAuth().api.verifyTOTP({
      headers,
      body: { code: input.code },
    });
  } catch (error) {
    mapVerificationFailure(error);
  }

  return recordStaffSessionGrant(
    moderator.userId,
    resolved.session.id,
    moderator.profile.staffRole === "moderator"
      ? moderator.profile.staffMunicipalityId
      : null,
    "staff.session_verified_totp",
  );
}

export async function verifyStaffRecoveryCode(
  headers: Headers,
  resolved: ResolvedSession,
  input: VerifyRecoveryCodeInput,
): Promise<{ verifiedUntil: string }> {
  const moderator = requireModerator(resolved.viewer);
  if (!resolved.session) throw new ORPCError("UNAUTHORIZED");

  await enforceStepUpRateLimits(moderator.userId, headers);
  await assertTotpEnrolled(moderator.userId);

  try {
    await getAuth().api.verifyBackupCode({
      headers,
      body: { code: input.code, disableSession: true },
    });
  } catch (error) {
    mapVerificationFailure(error);
  }

  return recordStaffSessionGrant(
    moderator.userId,
    resolved.session.id,
    moderator.profile.staffRole === "moderator"
      ? moderator.profile.staffMunicipalityId
      : null,
    "staff.session_verified_recovery_code",
  );
}

export async function assertStaffSessionVerified(
  resolved: ResolvedSession,
): Promise<void> {
  const moderator = requireModerator(resolved.viewer);
  if (!resolved.session) {
    throw new ORPCError("UNAUTHORIZED");
  }

  const now = new Date();
  const [grant] = await db
    .select({ sessionId: staffSessionVerifications.sessionId })
    .from(staffSessionVerifications)
    .innerJoin(session, eq(session.id, staffSessionVerifications.sessionId))
    .where(
      and(
        eq(staffSessionVerifications.sessionId, resolved.session.id),
        gt(staffSessionVerifications.expiresAt, now),
        eq(session.userId, moderator.userId),
        gt(session.expiresAt, now),
      ),
    )
    .limit(1);

  if (grant) return;
  if (isLocalDemoStaffBypassAllowed(resolved)) return;

  throw new ORPCError("FORBIDDEN", {
    message: "Complete two-factor verification for this staff session.",
    data: { reason: "staff_step_up_required" },
  });
}

export async function revokeUserStaffSessions(
  executor: Executor,
  userId: string,
): Promise<void> {
  const userSessions = executor
    .select({ id: session.id })
    .from(session)
    .where(eq(session.userId, userId));

  await executor
    .delete(staffSessionVerifications)
    .where(inArray(staffSessionVerifications.sessionId, userSessions));
}

export async function clearExpiredStaffSessionVerifications(
  executor: Db = db,
): Promise<number> {
  const removed = await executor
    .delete(staffSessionVerifications)
    .where(lte(staffSessionVerifications.expiresAt, new Date()))
    .returning({ sessionId: staffSessionVerifications.sessionId });
  return removed.length;
}
