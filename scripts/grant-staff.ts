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
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { memberProfiles, user } from "@/db/schema";
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
  console.error(`no account matches "${identifier}"`);
  process.exit(1);
}

const [profile] = await db
  .update(memberProfiles)
  .set({ staffRole: role })
  .where(eq(memberProfiles.userId, account.id))
  .returning({
    displayName: memberProfiles.displayName,
    tier: memberProfiles.tier,
    cedulaStatus: memberProfiles.cedulaStatus,
    staffRole: memberProfiles.staffRole,
    municipalityId: memberProfiles.municipalityId,
  });

if (!profile) {
  console.error(`account ${account.id} has no member profile`);
  process.exit(1);
}

console.info(
  `${profile.displayName} is now "${profile.staffRole}" (${profile.municipalityId ?? "no municipality"})`,
);

// Moderating requires a verified cédula, so say so rather than letting them
// discover it as a 403 on a page that looked available.
if (role !== "none" && profile.cedulaStatus !== "verified") {
  console.warn(
    `warning: cedula status is "${profile.cedulaStatus}". The moderation desk stays closed until it is "verified".`,
  );
}

process.exit(0);
