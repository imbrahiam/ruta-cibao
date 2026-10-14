/**
 * Appointing a moderator.
 *
 * There is no screen for this on purpose. Granting somebody authority over
 * other people's contributions is an act of the institution running the
 * platform, not a self-service setting, and it belongs in a shell someone had
 * to be given access to.
 *
 *   bun run scripts/grant-staff.ts <phone|email|userId> moderator
 *   bun run scripts/grant-staff.ts <phone|email|userId> none
 */
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberProfiles, user } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";

const [identifier, role = "moderator"] = process.argv.slice(2);

if (!identifier) {
  console.error(
    "usage: bun run scripts/grant-staff.ts <phone|email|userId> [moderator|admin|none]",
  );
  process.exit(1);
}

if (role !== "moderator" && role !== "admin" && role !== "none") {
  console.error(`unknown role: ${role}`);
  process.exit(1);
}

const phone = normalizePhone(identifier);

const [account] = await db
  .select({ id: user.id, email: user.email })
  .from(user)
  .where(
    or(
      eq(user.id, identifier),
      eq(user.email, identifier),
      ...(phone ? [eq(user.phoneNumber, phone)] : []),
    ),
  )
  .limit(1);

if (!account) {
  console.error("No account matches the supplied identifier");
  process.exit(1);
}

const bootstrap = process.argv.includes("--bootstrap-verified-in-person");
await db.transaction(async (tx) => {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('staff-bootstrap', 0))`,
  );
  const [profile] = await tx
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, account.id))
    .limit(1)
    .for("update");
  if (!profile) throw new Error("Member profile missing");
  if (bootstrap) {
    if (role !== "admin")
      throw new Error("Bootstrap is only for the first administrator");
    const [existing] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(memberProfiles)
      .where(
        sql`${memberProfiles.staffRole} = 'admin' and ${memberProfiles.cedulaStatus} = 'verified'`,
      );
    if ((existing?.count ?? 0) > 0)
      throw new Error(
        "An administrator already exists; use the document review flow",
      );
    if (
      !profile.verifiedFullName ||
      !profile.cedulaCiphertext ||
      !profile.municipalityId ||
      profile.cedulaStatus !== "matched"
    )
      throw new Error(
        "Bootstrap requires a matched registry lookup and municipality, with no open review",
      );
    // The explicit flag attests that the institution checked this person
    // in person. Shell access alone never silently bypasses document review.
    await tx
      .update(memberProfiles)
      .set({
        tier: "citizen",
        cedulaStatus: "verified",
        verifiedAt: new Date(),
        staffRole: "admin",
      })
      .where(eq(memberProfiles.userId, account.id));
  } else {
    if (
      role !== "none" &&
      (profile.cedulaStatus !== "verified" || profile.tier !== "citizen")
    )
      throw new Error("Verify the resident before granting a staff role");
    await tx
      .update(memberProfiles)
      .set({ staffRole: role })
      .where(eq(memberProfiles.userId, account.id));
  }
  await recordAudit(
    {
      action: bootstrap ? "staff.bootstrapped_in_person" : "staff.role_changed",
      subjectType: "member_profile",
      subjectId: profile.id,
      municipalityId: profile.municipalityId,
      metadata: { role, source: "operator_cli" },
    },
    tx,
  );
});
console.info("Staff role updated", { userId: account.id, role, bootstrap });

process.exit(0);
