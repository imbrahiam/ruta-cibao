/**
 * Retires the cédula/identity-document system's stored evidence.
 *
 * One-shot and idempotent: run it after migration 0028 and before the
 * migration that drops the identity tables. It deletes every encrypted
 * document photo still referenced by `identity_reviews`, marks each review as
 * purged only after its objects are gone, then sweeps whatever is left under
 * the `identity/` prefix (abandoned staging uploads). Any deletion failure
 * stops the run with a non-zero exit, leaving the keys in place so the next run
 * can retry; the dropping migration refuses to run while a review still has
 * unpurged documents.
 *
 *   bun --env-file=.env run scripts/ops/retire-identity.ts
 *
 * Nothing is archived, decrypted, or sent to the civil registry.
 */

import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { recordAudit } from "@/lib/audit";
import { deleteObject, listObjectKeys } from "@/lib/storage";

const IDENTITY_PREFIX = "identity/";

type PendingReview = {
  id: string;
  municipality_id: string;
  front_key: string;
  selfie_key: string;
  residence_key: string | null;
};

async function identityTableExists(): Promise<boolean> {
  const result = await db.execute<{ exists: boolean }>(
    sql`select to_regclass('public.identity_reviews') is not null as exists`,
  );
  return Boolean(result.rows[0]?.exists);
}

async function purgeReferencedDocuments(): Promise<number> {
  if (!(await identityTableExists())) return 0;

  const pending = await db.execute<PendingReview>(
    sql`select id, municipality_id, front_key, selfie_key, residence_key
        from identity_reviews where documents_purged_at is null`,
  );

  let purged = 0;
  for (const review of pending.rows) {
    const keys = [review.front_key, review.selfie_key, review.residence_key];
    for (const key of keys) if (key) await deleteObject(key);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`update identity_reviews set documents_purged_at = now()
            where id = ${review.id} and documents_purged_at is null`,
      );
      await recordAudit(
        {
          action: "identity_review.documents_purged",
          subjectType: "identity_review",
          subjectId: review.id,
          municipalityId: review.municipality_id,
          metadata: { reason: "identity_retirement" },
        },
        tx,
      );
    });
    purged++;
  }
  return purged;
}

async function sweepPrefix(): Promise<number> {
  const keys = await listObjectKeys(IDENTITY_PREFIX);
  for (const key of keys) await deleteObject(key);
  return keys.length;
}

try {
  const reviews = await purgeReferencedDocuments();
  const stray = await sweepPrefix();
  const remaining = await listObjectKeys(IDENTITY_PREFIX);
  if (remaining.length > 0) {
    throw new Error(
      `${remaining.length} objects remain under ${IDENTITY_PREFIX}; run again`,
    );
  }
  console.log(
    `identity retirement complete: ${reviews} reviews purged, ${stray} objects removed under ${IDENTITY_PREFIX}`,
  );
} catch (error) {
  console.error(
    "identity retirement stopped; nothing destructive beyond completed deletions happened. Retry the command.",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
