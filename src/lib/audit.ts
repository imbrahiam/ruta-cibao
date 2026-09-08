/**
 * The audit trail.
 *
 * Every mutation writes one row. A municipality has to be able to answer "who
 * approved this, and when" long after the fact, and the trail is also what
 * makes moderation decisions contestable rather than opaque.
 *
 * Writing is deliberately forgiving: a failure to record an audit row is
 * logged, not thrown. Losing the record of an approval is bad; refusing the
 * approval because the record failed is worse.
 */
import { type Db, type DbTransaction, db } from "@/db";
import { auditEvents } from "@/db/schema";
import { hashLookup } from "@/lib/crypto";

export type AuditInput = {
  actorUserId?: string | null;
  /** Dotted verb: `place.approved`, `consultation.answered`, `member.verified`. */
  action: string;
  subjectType: string;
  subjectId?: string | null;
  municipalityId?: string | null;
  /** Context that makes the entry intelligible later. Never raw personal data. */
  metadata?: Record<string, unknown>;
  /** Raw address; stored only as a hash. */
  ip?: string | null;
};

export async function recordAudit(
  input: AuditInput,
  executor: Db | DbTransaction = db,
): Promise<void> {
  try {
    await executor.insert(auditEvents).values({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      subjectType: input.subjectType,
      subjectId: input.subjectId ?? null,
      municipalityId: input.municipalityId ?? null,
      metadata: input.metadata ?? {},
      ipHash: input.ip ? hashLookup("audit-ip", input.ip) : null,
    });
  } catch (error) {
    console.error("failed to record audit event", {
      action: input.action,
      error,
    });
  }
}
