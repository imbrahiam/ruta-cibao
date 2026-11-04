/**
 * Appointing or removing staff.
 *
 * There is no screen for this on purpose. Granting somebody authority over
 * other people's contributions is an act of the institution running the
 * platform, not a self-service setting, and it belongs in a shell someone had
 * to be given access to.
 *
 *   bun run scripts/ops/grant-staff.ts <phone|email|userId> moderator --municipality <id>
 *   bun run scripts/ops/grant-staff.ts <phone|email|userId> admin --approved-in-person
 *   bun run scripts/ops/grant-staff.ts <phone|email|userId> none
 *
 * The account must already exist with a verified phone or email. A moderator
 * is confined to one municipality; an admin has the whole province and
 * requires the explicit attestation that the institution approved the person
 * in person. This is the only path that changes staff jurisdiction, and it
 * keeps Better Auth's own admin flag in step with it.
 */

import { parseArgs } from "node:util";
import { normalizePhone } from "@ruta/shared/phone";
import { eq, or, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { memberProfiles, municipalities, twoFactor, user } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { revokeUserStaffSessions } from "@/modules/access/staff-session";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    municipality: { type: "string" },
    "approved-in-person": { type: "boolean", default: false },
  },
});

const [identifier, role] = positionals;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!identifier || !role) {
  fail(
    "usage: bun run scripts/ops/grant-staff.ts <phone|email|userId> <moderator --municipality <id> | admin --approved-in-person | none>",
  );
}
if (role !== "moderator" && role !== "admin" && role !== "none") {
  fail(`unknown role: ${role}`);
}
if (role === "moderator" && !values.municipality) {
  fail("a moderator needs --municipality <id>");
}
if (role !== "moderator" && values.municipality) {
  fail("--municipality applies only to moderators");
}
if (role === "admin" && !values["approved-in-person"]) {
  fail(
    "an administrator needs --approved-in-person: the institution must approve them in person",
  );
}

const phone = normalizePhone(identifier);

try {
  const [account] = await db
    .select({
      id: user.id,
      emailVerified: user.emailVerified,
      phoneNumberVerified: user.phoneNumberVerified,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .where(
      or(
        eq(user.id, identifier),
        eq(user.email, identifier.toLowerCase()),
        ...(phone ? [eq(user.phoneNumber, phone)] : []),
      ),
    )
    .limit(1);

  if (!account) fail("No account matches the supplied identifier");
  if (role !== "none" && !account.emailVerified && !account.phoneNumberVerified)
    fail("The account has no verified phone or email");
  if (role !== "none") {
    const [enrolled] = await db
      .select({ verified: twoFactor.verified })
      .from(twoFactor)
      .where(eq(twoFactor.userId, account.id))
      .limit(1);
    if (!account.twoFactorEnabled || !enrolled?.verified) {
      fail(
        "The account must complete TOTP two-factor enrollment before receiving staff authority",
      );
    }
  }

  const staffMunicipalityId = role === "moderator" ? values.municipality : null;
  if (staffMunicipalityId) {
    const [municipality] = await db
      .select({ id: municipalities.id })
      .from(municipalities)
      .where(eq(municipalities.id, staffMunicipalityId))
      .limit(1);
    if (!municipality) fail(`unknown municipality: ${staffMunicipalityId}`);
  }

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('staff-grant', 0))`,
    );
    const [profile] = await tx
      .select()
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, account.id))
      .limit(1)
      .for("update");
    if (!profile) throw new Error("Member profile missing");

    if (role !== "admin" && profile.staffRole === "admin") {
      const [admins] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(memberProfiles)
        .where(eq(memberProfiles.staffRole, "admin"));
      if ((admins?.count ?? 0) <= 1)
        throw new Error(
          "This is the last administrator; appoint another one first",
        );
    }

    await tx
      .update(memberProfiles)
      .set({ staffRole: role, staffMunicipalityId })
      .where(eq(memberProfiles.userId, account.id));
    await tx
      .update(user)
      .set({ role: role === "admin" ? "admin" : "user" })
      .where(eq(user.id, account.id));
    await revokeUserStaffSessions(tx, account.id);

    await recordAudit(
      {
        action: "staff.role_changed",
        subjectType: "member",
        subjectId: account.id,
        municipalityId: staffMunicipalityId,
        metadata: {
          role,
          previousRole: profile.staffRole,
          previousStaffMunicipalityId: profile.staffMunicipalityId,
          approvedInPerson: values["approved-in-person"],
          source: "operator_cli",
        },
      },
      tx,
    );
  });
  console.info("Staff role updated", {
    userId: account.id,
    role,
    staffMunicipalityId,
  });
} finally {
  await pool.end();
}
