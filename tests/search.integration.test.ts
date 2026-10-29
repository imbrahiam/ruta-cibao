import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { call } from "@orpc/server";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  municipalities,
  places,
  user,
  userBlocks,
} from "@/db/schema";
import type { Viewer } from "@/modules/access/viewer";
import { placesRouter } from "@/orpc/routers/places";
import {
  assertDedicatedLocalDatabase,
  context,
  createMember,
} from "./support/test-db";

/**
 * The search field is the only way into the map for someone who does not
 * already know a place's name. Its promises are specific: accents do not
 * matter, a near-miss spelling still finds the place, a prefix beats a fuzzy
 * match, a category answers a search, and nothing unpublished or authored by
 * somebody the viewer blocked leaks through either search path.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("place search", () => {
  const prefix = `search-test-${crypto.randomUUID().slice(0, 8)}`;
  const town = `${prefix}-town`;
  const health = `${prefix}-health`;
  const food = `${prefix}-food`;
  const accountIds: string[] = [];
  let guarded = false;

  async function place(options: {
    name: string;
    description?: string;
    status?: "pending" | "published";
    categoryId: string;
    authorId?: string | null;
  }) {
    const [row] = await db
      .insert(places)
      .values({
        slug: `${prefix}-${crypto.randomUUID()}`,
        name: options.name,
        description: options.description ?? null,
        categoryId: options.categoryId,
        municipalityId: town,
        location: { x: -71.3, y: 19.45 },
        status: options.status ?? "published",
        createdByUserId: options.authorId ?? null,
      })
      .returning({ id: places.id, slug: places.slug, name: places.name });
    if (!row) throw new Error("place insert failed");
    return row;
  }

  const search = (query: string, viewer: Viewer = { kind: "anonymous" }) =>
    call(
      placesRouter.search,
      { query, addresses: false },
      { context: context(viewer) },
    );

  const browse = (query: string, viewer: Viewer = { kind: "anonymous" }) =>
    call(
      placesRouter.browse,
      { query, category: "", municipality: "", offset: 0, limit: 48 },
      { context: context(viewer) },
    );

  beforeAll(async () => {
    assertDedicatedLocalDatabase();
    guarded = true;
    await db
      .insert(municipalities)
      .values({ id: town, name: "Synthetic search town" });
    await db.insert(categories).values([
      { id: health, kind: "place", name: "Salud" },
      { id: food, kind: "place", name: "Comida" },
    ]);
  });

  afterAll(async () => {
    if (!guarded) return;
    await db
      .delete(userBlocks)
      .where(inArray(userBlocks.blockingUserId, accountIds));
    await db.delete(places).where(eq(places.municipalityId, town));
    await db.delete(categories).where(inArray(categories.id, [health, food]));
    if (accountIds.length > 0) {
      await db.delete(user).where(inArray(user.id, accountIds));
    }
    await db.delete(municipalities).where(eq(municipalities.id, town));
  });

  test("a near-miss spelling finds the place, and an unpublished one stays hidden", async () => {
    const published = await place({
      name: "Hospital Quiribamba",
      categoryId: health,
    });
    const pending = await place({
      name: "Hospital Quiribamba Oculto",
      categoryId: health,
      status: "pending",
    });

    const results = await search("hospitl");
    const slugs = results.places.map((row) => row.slug);
    expect(slugs).toContain(published.slug);
    expect(slugs).not.toContain(pending.slug);
  });

  test("accents are ignored in both the name and the query", async () => {
    const target = await place({
      name: "Mirador Monción",
      description: "Vista al río Quiribamba",
      categoryId: food,
    });

    const byName = await search("moncion");
    expect(byName.places.map((row) => row.slug)).toContain(target.slug);

    // The browse filter is substring matching over the description, used by
    // the map list rather than the search field, and has to be just as
    // accent-insensitive.
    const byDescription = await browse("rio quiribamba");
    expect(byDescription.items.map((row) => row.slug)).toContain(target.slug);
  });

  test("a category name answers a search, and a prefix outranks a fuzzy match", async () => {
    const hospital = await place({
      name: "Puesto Quiribamba",
      categoryId: health,
    });
    const first = await place({
      name: "Comedor Quiribamba Uno",
      categoryId: food,
    });
    const second = await place({
      name: "Comedor Quiribamba Dos",
      categoryId: food,
    });
    // `word_similarity('comedor', 'comedor ...')` is 1; this one is 0.625,
    // high enough to appear but never above the real prefix matches.
    const fuzzy = await place({
      name: "Comedia Quiribamba",
      categoryId: food,
    });

    const byCategory = await search("salud");
    expect(byCategory.places.map((row) => row.slug)).toContain(hospital.slug);

    const results = (await search("comedor")).places.map((row) => row.slug);
    expect(results).toContain(first.slug);
    expect(results).toContain(second.slug);
    const fuzzyIndex = results.indexOf(fuzzy.slug);
    if (fuzzyIndex !== -1) {
      expect(fuzzyIndex).toBeGreaterThan(results.indexOf(first.slug));
      expect(fuzzyIndex).toBeGreaterThan(results.indexOf(second.slug));
    }
  });

  test("a place authored by somebody the viewer blocked is absent for that viewer only", async () => {
    const blocked = await createMember(prefix);
    accountIds.push(blocked.id);
    const target = await place({
      name: "Farmacia Quiribamba",
      categoryId: health,
      authorId: blocked.id,
    });

    const viewer = await createMember(prefix);
    accountIds.push(viewer.id);
    await db.insert(userBlocks).values({
      blockingUserId: viewer.id,
      blockedUserId: blocked.id,
    });

    const anonymous = await search("farmacia quiribamba");
    expect(anonymous.places.map((row) => row.slug)).toContain(target.slug);

    const blockedView = await search("farmacia quiribamba", viewer.viewer);
    expect(blockedView.places.map((row) => row.slug)).not.toContain(
      target.slug,
    );

    const blockedBrowse = await browse("farmacia quiribamba", viewer.viewer);
    expect(blockedBrowse.items.map((row) => row.slug)).not.toContain(
      target.slug,
    );
  });
});
