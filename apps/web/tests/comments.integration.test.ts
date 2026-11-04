import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  comments,
  municipalities,
  places,
  user,
  userBlocks,
} from "@/db/schema";
import {
  CommentError,
  createComment,
  deleteComment,
  listComments,
} from "@/modules/comments/service";
import {
  assertDedicatedLocalDatabase,
  auditsFor,
  createMember,
} from "./support/test-db";

/**
 * Experiences of a place, as a resident leaves them: published at once,
 * written once even if the phone retries, gone for whoever blocked the
 * author, and taken down only by the person who wrote it.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("comments", () => {
  const prefix = `comments-${crypto.randomUUID().slice(0, 8)}`;
  const town = `${prefix}-town`;
  const category = `${prefix}-place`;
  const slug = `${prefix}-colmado`;
  const accountIds: string[] = [];
  let guarded = false;

  beforeAll(async () => {
    assertDedicatedLocalDatabase();
    guarded = true;
    await db.insert(municipalities).values({
      id: town,
      name: "Synthetic comments town",
      boundary:
        "SRID=4326;MULTIPOLYGON(((30 30,30.01 30,30.01 30.01,30 30.01,30 30)))",
    });
    await db
      .insert(categories)
      .values({ id: category, kind: "place", name: "Lugares" });
    await db.insert(places).values({
      slug,
      name: "Colmado sintético",
      categoryId: category,
      municipalityId: town,
      location: { x: 30.005, y: 30.005 },
      status: "published",
    });
  });

  afterAll(async () => {
    if (!guarded) return;
    await db.delete(comments).where(eq(comments.municipalityId, town));
    await db.delete(places).where(eq(places.municipalityId, town));
    await db.delete(categories).where(eq(categories.id, category));
    if (accountIds.length > 0) {
      await db.delete(user).where(inArray(user.id, accountIds));
    }
    await db.delete(municipalities).where(eq(municipalities.id, town));
  });

  test("an experience is published at once, once, with a trail", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);
    const request = {
      requestId: crypto.randomUUID(),
      kind: "place" as const,
      ref: slug,
      body: "Abren temprano y tienen pan caliente.",
    };

    const first = await createComment(db, member.viewer, request);
    const retry = await createComment(db, member.viewer, request);
    expect(retry.id).toBe(first.id);

    const listed = await listComments(
      db,
      { kind: "anonymous" },
      {
        kind: "place",
        ref: slug,
        offset: 0,
        limit: 20,
      },
    );
    expect(listed.items.map((item) => item.id)).toContain(first.id);
    expect(listed.items.filter((item) => item.id === first.id)).toHaveLength(1);

    const trail = await auditsFor(member.id, "comment.created");
    expect(trail.map((event) => event.subjectId)).toContain(first.id);
  });

  test("someone who blocked the author no longer sees their comments", async () => {
    const author = await createMember(prefix);
    const reader = await createMember(prefix);
    accountIds.push(author.id, reader.id);
    const written = await createComment(db, author.viewer, {
      requestId: crypto.randomUUID(),
      kind: "place",
      ref: slug,
      body: "Cierran a las 9.",
    });
    await db
      .insert(userBlocks)
      .values({ blockingUserId: reader.id, blockedUserId: author.id });

    const seen = await listComments(db, reader.viewer, {
      kind: "place",
      ref: slug,
      offset: 0,
      limit: 50,
    });
    expect(seen.items.map((item) => item.id)).not.toContain(written.id);
  });

  test("only the author can take a comment down", async () => {
    const author = await createMember(prefix);
    const other = await createMember(prefix);
    accountIds.push(author.id, other.id);
    const written = await createComment(db, author.viewer, {
      requestId: crypto.randomUUID(),
      kind: "place",
      ref: slug,
      body: "Buen servicio.",
    });

    await expect(
      deleteComment(db, other.viewer, written.id),
    ).rejects.toBeInstanceOf(CommentError);
    await deleteComment(db, author.viewer, written.id);

    const [row] = await db
      .select({ status: comments.status })
      .from(comments)
      .where(eq(comments.id, written.id));
    expect(row?.status).toBe("hidden");
  });

  test("a place nobody can see takes no comments", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);
    await expect(
      createComment(db, member.viewer, {
        requestId: crypto.randomUUID(),
        kind: "place",
        ref: `${prefix}-missing`,
        body: "Hola",
      }),
    ).rejects.toMatchObject({ reason: "not_found" });
  });
});
