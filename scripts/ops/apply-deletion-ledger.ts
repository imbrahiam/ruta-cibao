/**
 * Re-applies completed account deletions after a restore.
 *
 * The ledger lives in object storage under `deletion-ledger/`, outside the
 * database backups, so a database restored from an older snapshot can still be
 * brought back in line: every account that asked to be deleted is deleted again
 * before the restored system is made public. Restore automation runs this as a
 * required step. Safe to run any number of times.
 *
 *   bun --env-file=.env run scripts/ops/apply-deletion-ledger.ts
 */

import { pool } from "@/db";
import { getObjectBytes, listObjectKeys } from "@/lib/storage";
import {
  LEDGER_PREFIX,
  parseTombstone,
  reapplyDeletionTombstone,
} from "@/modules/account/deletion";

async function main() {
  const keys = (await listObjectKeys(LEDGER_PREFIX)).filter((key) =>
    key.endsWith(".json"),
  );
  let reapplied = 0;
  let absent = 0;
  for (const key of keys) {
    const tombstone = parseTombstone(await getObjectBytes(key));
    if (!tombstone) {
      console.error(`ledger entry is not a tombstone: ${key}`);
      process.exitCode = 1;
      continue;
    }
    const result = await reapplyDeletionTombstone(tombstone);
    if (result.status === "reapplied") reapplied++;
    else absent++;
  }
  console.info(
    `deletion ledger applied: ${keys.length} entries, ${reapplied} re-applied, ${absent} already absent`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("deletion ledger failed", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
