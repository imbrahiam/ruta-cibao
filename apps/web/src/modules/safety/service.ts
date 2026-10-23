import type {
  BlockAuthorInput,
  ContentTarget,
  HiddenTargetsInput,
  ReportContentInput,
  UnblockAuthorInput,
} from "@ruta/contracts";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentReports, memberProfiles, userBlocks } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { MemberViewer } from "@/modules/access/viewer";
import { resolveContentTarget } from "./targets";

/**
 * Reporting harmful content and choosing whose contributions to hide.
 *
 * Both need a member with a verified contact. A report goes to the staff of the
 * municipality the content belongs to, which is read from the content, never
 * from the caller. A block is private to the blocker: it changes what that one
 * person sees and tells nobody.
 */
export class SafetyError extends Error {
  constructor(
    readonly reason:
      | "not_found"
      | "own_content"
      | "no_author"
      | "institutional_author"
      | "rate_limited",
  ) {
    super(reason);
    this.name = "SafetyError";
  }
}

const REPORT_POLICY = {
  scope: "safety-report",
  limit: 20,
  windowMs: 60 * 60 * 1_000,
};
const BLOCK_POLICY = {
  scope: "safety-block",
  limit: 30,
  windowMs: 60 * 60 * 1_000,
};

export async function reportContent(
  viewer: MemberViewer,
  input: ReportContentInput,
) {
  const outcome = await withIdempotency({
    key: `safety:report:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const subject = await resolveContentTarget(tx, input.target);
      // Only what the reporter can actually see: a private or removed item
      // reads as unknown, so a report cannot be used to probe for it.
      if (!subject) throw new SafetyError("not_found");
      const isAuthor = subject.authorUserId === viewer.userId;
      if (isAuthor) throw new SafetyError("own_content");
      if (!subject.publiclyVisible) throw new SafetyError("not_found");

      // A repeat of an open report adds nothing for a reviewer: return it.
      const [existing] = await tx
        .select({ id: contentReports.id })
        .from(contentReports)
        .where(
          and(
            eq(contentReports.reporterUserId, viewer.userId),
            eq(contentReports.subjectKind, subject.kind),
            eq(contentReports.subjectRef, subject.ref),
            eq(contentReports.status, "open"),
          ),
        )
        .limit(1);
      if (existing) return { id: existing.id };

      const allowance = await consumeRateLimit(viewer.userId, REPORT_POLICY);
      if (!allowance.allowed) throw new SafetyError("rate_limited");

      const [created] = await tx
        .insert(contentReports)
        .values({
          reporterUserId: viewer.userId,
          subjectKind: subject.kind,
          subjectRef: subject.ref,
          authorUserId: subject.authorUserId,
          municipalityId: subject.municipalityId,
          reason: input.reason,
          details: input.details || null,
        })
        .returning({ id: contentReports.id });
      if (!created) throw new Error("Content report insert returned no row.");

      // The details are free text and may name someone: they stay in the
      // report row, never in the audit trail.
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "content.reported",
          subjectType: "content_report",
          subjectId: created.id,
          municipalityId: subject.municipalityId,
          metadata: { kind: subject.kind, reason: input.reason },
        },
        tx,
      );
      return { id: created.id };
    },
  });

  return { id: outcome.result.id, status: "open" as const };
}

export async function blockAuthor(
  viewer: MemberViewer,
  input: BlockAuthorInput,
) {
  const outcome = await withIdempotency({
    key: `safety:block:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const subject = await resolveContentTarget(tx, input.target);
      if (!subject) throw new SafetyError("not_found");
      if (subject.authorUserId !== viewer.userId && !subject.publiclyVisible) {
        throw new SafetyError("not_found");
      }
      // A seeded or institutional record has no person behind it to block.
      if (!subject.authorUserId) throw new SafetyError("no_author");
      if (subject.authorUserId === viewer.userId) {
        throw new SafetyError("own_content");
      }

      const [author] = await tx
        .select({ staffRole: memberProfiles.staffRole })
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, subject.authorUserId))
        .limit(1);
      // Staff speak for the institution: their replies and records stay visible.
      if (author && author.staffRole !== "none") {
        throw new SafetyError("institutional_author");
      }

      const [existing] = await tx
        .select({ id: userBlocks.id })
        .from(userBlocks)
        .where(
          and(
            eq(userBlocks.blockingUserId, viewer.userId),
            eq(userBlocks.blockedUserId, subject.authorUserId),
          ),
        )
        .limit(1);
      if (existing) return { blockId: existing.id };

      const allowance = await consumeRateLimit(viewer.userId, BLOCK_POLICY);
      if (!allowance.allowed) throw new SafetyError("rate_limited");

      const [created] = await tx
        .insert(userBlocks)
        .values({
          blockingUserId: viewer.userId,
          blockedUserId: subject.authorUserId,
        })
        .onConflictDoNothing()
        .returning({ id: userBlocks.id });
      if (!created) {
        const [raced] = await tx
          .select({ id: userBlocks.id })
          .from(userBlocks)
          .where(
            and(
              eq(userBlocks.blockingUserId, viewer.userId),
              eq(userBlocks.blockedUserId, subject.authorUserId),
            ),
          )
          .limit(1);
        if (!raced) throw new Error("User block insert returned no row.");
        return { blockId: raced.id };
      }

      // The blocked account is not recorded: the trail explains who acted and
      // on what kind of content, not whom they are avoiding.
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "user.blocked",
          subjectType: "user_block",
          subjectId: created.id,
          metadata: { kind: subject.kind },
        },
        tx,
      );
      return { blockId: created.id };
    },
  });

  return outcome.result;
}

export async function listBlocks(viewer: MemberViewer) {
  return db
    .select({ id: userBlocks.id, displayName: memberProfiles.displayName })
    .from(userBlocks)
    .leftJoin(
      memberProfiles,
      eq(memberProfiles.userId, userBlocks.blockedUserId),
    )
    .where(eq(userBlocks.blockingUserId, viewer.userId))
    .orderBy(userBlocks.createdAt);
}

export async function unblockAuthor(
  viewer: MemberViewer,
  input: UnblockAuthorInput,
) {
  const outcome = await withIdempotency({
    key: `safety:unblock:${viewer.userId}:${input.requestId}`,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      // Scoped to the caller's own rows: somebody else's block id removes nothing.
      const removed = await tx
        .delete(userBlocks)
        .where(
          and(
            eq(userBlocks.id, input.blockId),
            eq(userBlocks.blockingUserId, viewer.userId),
          ),
        )
        .returning({ id: userBlocks.id });

      if (removed.length > 0) {
        await recordAudit(
          {
            actorUserId: viewer.userId,
            action: "user.unblocked",
            subjectType: "user_block",
            subjectId: input.blockId,
          },
          tx,
        );
      }
      return { removed: removed.length > 0 };
    },
  });

  return outcome.result;
}

type Cursor = { kind: string; ref: string };

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify([cursor.kind, cursor.ref])).toString(
    "base64url",
  );
}

function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    ) {
      return { kind: parsed[0], ref: parsed[1] };
    }
  } catch {
    // Falls through to the invalid case below.
  }
  return null;
}

/**
 * The published contributions, by authors this person blocked, as references.
 *
 * The app caches the complete list and applies it to its offline snapshot,
 * map layers and detail screens. No author id leaves the server: the answer is
 * only "these things are hidden from you". Keyset pagination over
 * (kind, ref) keeps pages stable while blocks change.
 */
export async function hiddenTargets(
  viewer: MemberViewer,
  input: HiddenTargetsInput,
): Promise<{ items: ContentTarget[]; nextCursor: string | null }> {
  const cursor = input.cursor ? decodeCursor(input.cursor) : null;
  if (input.cursor && !cursor) throw new SafetyError("not_found");

  const blocked = sql`(select ${userBlocks.blockedUserId} from ${userBlocks} where ${userBlocks.blockingUserId} = ${viewer.userId})`;
  const result = await db.execute<{
    kind: ContentTarget["kind"];
    ref: string;
  }>(sql`
    select kind, ref from (
      select 'place' as kind, slug as ref from places
        where status = 'published' and created_by_user_id in ${blocked}
      union all
      select 'photo', p.id::text from place_photos p
        where p.status = 'published' and p.uploaded_by_user_id in ${blocked}
      union all
      select 'route', id::text from eco_routes
        where status = 'published' and submitted_by_user_id in ${blocked}
      union all
      select 'traffic', id::text from traffic_reports
        where status = 'active' and expires_at > now() and reported_by_user_id in ${blocked}
      union all
      select 'consultation', slug from consultations
        where publication_status = 'published' and opened_by_user_id in ${blocked}
    ) hidden
    ${cursor ? sql`where (kind, ref) > (${cursor.kind}, ${cursor.ref})` : sql``}
    order by kind, ref
    limit ${input.limit + 1}
  `);

  const rows = result.rows;
  const page = rows.slice(0, input.limit);
  const last = page.at(-1);
  return {
    items: page,
    nextCursor:
      rows.length > input.limit && last
        ? encodeCursor({ kind: last.kind, ref: last.ref })
        : null,
  };
}
