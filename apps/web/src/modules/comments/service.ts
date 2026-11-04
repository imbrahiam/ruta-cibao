import type { CommentSubjectKind } from "@ruta/contracts";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db, DbTransaction } from "@/db";
import {
  comments,
  consultations,
  memberProfiles,
  places,
  user,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { consumeRateLimit } from "@/lib/rate-limit";
import type { MemberViewer, Viewer } from "@/modules/access/viewer";
import { notBlockedAuthor } from "@/modules/safety/blocks";

export class CommentError extends Error {
  constructor(readonly reason: "not_found" | "too_many") {
    super(reason);
  }
}

type Executor = Db | DbTransaction;

/** A consultation or place that people other than its author can see. */
async function publicSubject(
  executor: Executor,
  kind: CommentSubjectKind,
  ref: string,
): Promise<{ id: string; municipalityId: string } | null> {
  if (kind === "consultation") {
    const [row] = await executor
      .select({
        id: consultations.id,
        municipalityId: consultations.municipalityId,
      })
      .from(consultations)
      .where(
        and(
          eq(consultations.slug, ref),
          eq(consultations.publicationStatus, "published"),
        ),
      )
      .limit(1);
    return row ?? null;
  }
  const [row] = await executor
    .select({ id: places.id, municipalityId: places.municipalityId })
    .from(places)
    .where(and(eq(places.slug, ref), eq(places.status, "published")))
    .limit(1);
  return row ?? null;
}

/**
 * Published comments, minus those by people the viewer blocked. A
 * consultation reads as a conversation (oldest first); experiences of a place
 * read newest first, so what's current comes first.
 */
export async function listComments(
  db: Db,
  viewer: Viewer,
  input: {
    kind: CommentSubjectKind;
    ref: string;
    offset: number;
    limit: number;
  },
) {
  const subject = await publicSubject(db, input.kind, input.ref);
  if (!subject) throw new CommentError("not_found");

  const filters = and(
    eq(comments.subjectKind, input.kind),
    eq(comments.subjectId, subject.id),
    eq(comments.status, "published"),
    notBlockedAuthor(comments.authorUserId, viewer),
  );
  const viewerId = viewer.kind === "member" ? viewer.userId : null;

  const [rows, [counted]] = await Promise.all([
    db
      .select({
        id: comments.id,
        body: comments.body,
        authorUserId: comments.authorUserId,
        author: memberProfiles.displayName,
        authorImage: user.image,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(user, eq(user.id, comments.authorUserId))
      .leftJoin(
        memberProfiles,
        eq(memberProfiles.userId, comments.authorUserId),
      )
      .where(filters)
      .orderBy(
        input.kind === "consultation"
          ? asc(comments.createdAt)
          : desc(comments.createdAt),
      )
      .offset(input.offset)
      .limit(input.limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(comments)
      .where(filters),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      body: row.body,
      author: row.author ?? "",
      authorImage: row.authorImage,
      createdAt: row.createdAt.toISOString(),
      isMine: row.authorUserId === viewerId,
    })),
    total: counted?.total ?? 0,
  };
}

/** Publishes a comment at once; a retried request returns the first one. */
export async function createComment(
  db: Db,
  viewer: MemberViewer,
  input: {
    requestId: string;
    kind: CommentSubjectKind;
    ref: string;
    body: string;
  },
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const subject = await publicSubject(tx, input.kind, input.ref);
      if (!subject) throw new CommentError("not_found");

      // Enough for a real conversation, too few to flood a thread.
      const allowance = await consumeRateLimit(
        viewer.userId,
        { scope: "comment", limit: 20, windowMs: 3_600_000 },
        tx,
      );
      if (!allowance.allowed) throw new CommentError("too_many");

      const [row] = await tx
        .insert(comments)
        .values({
          subjectKind: input.kind,
          subjectId: subject.id,
          municipalityId: subject.municipalityId,
          authorUserId: viewer.userId,
          body: input.body.trim(),
        })
        .returning({ id: comments.id, createdAt: comments.createdAt });
      if (!row) throw new Error("comment insert returned nothing");

      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "comment.created",
          subjectType: "comment",
          subjectId: row.id,
          municipalityId: subject.municipalityId,
        },
        tx,
      );
      return { id: row.id, createdAt: row.createdAt.toISOString() };
    },
  });

  const [profile] = await db
    .select({ author: memberProfiles.displayName, image: user.image })
    .from(user)
    .leftJoin(memberProfiles, eq(memberProfiles.userId, user.id))
    .where(eq(user.id, viewer.userId))
    .limit(1);

  return {
    id: outcome.result.id,
    body: input.body.trim(),
    author: profile?.author ?? "",
    authorImage: profile?.image ?? null,
    createdAt: outcome.result.createdAt,
    isMine: true,
  };
}

/** The author takes their own comment down; anyone else's reads as missing. */
export async function deleteComment(
  db: Db,
  viewer: MemberViewer,
  commentId: string,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(comments)
      .set({ status: "hidden", updatedAt: new Date() })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.authorUserId, viewer.userId),
          eq(comments.status, "published"),
        ),
      )
      .returning({ id: comments.id, municipalityId: comments.municipalityId });
    if (!row) throw new CommentError("not_found");

    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: "comment.deleted",
        subjectType: "comment",
        subjectId: row.id,
        municipalityId: row.municipalityId,
      },
      tx,
    );
    return { status: "ok" as const };
  });
}
