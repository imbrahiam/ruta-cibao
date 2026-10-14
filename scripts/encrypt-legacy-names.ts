/**
 * Encrypts registry names written before `member_profiles.verified_full_name`
 * became an encrypted column.
 *
 *   bun run scripts/encrypt-legacy-names.ts
 *
 * Reads the raw column, so a plaintext value is recognised by its missing
 * `v1:` prefix, and writes it back through the schema, which encrypts it.
 * Safe to run any number of times: an encrypted row is never touched twice.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { memberProfiles } from "@/db/schema";

const rows = await db.execute<{ id: string; name: string }>(
  sql`select id, verified_full_name as name from member_profiles
      where verified_full_name is not null and verified_full_name not like 'v1:%'`,
);

for (const row of rows.rows) {
  await db
    .update(memberProfiles)
    .set({ verifiedFullName: row.name })
    .where(eq(memberProfiles.id, row.id));
}

console.log(`encrypted ${rows.rows.length} registry names`);
process.exit(0);
