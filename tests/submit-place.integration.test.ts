import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { SubmitPlaceInput } from "@ruta/contracts";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, municipalities, places, user } from "@/db/schema";
import {
  PlaceSubmissionError,
  submitPlace,
} from "@/modules/places/submit-place";
import {
  assertDedicatedLocalDatabase,
  auditsFor,
  createMember,
} from "./support/test-db";

/**
 * The contribution path a resident actually uses. The promises here are the
 * ones a person can feel: their place arrives, it is not visible until the
 * municipality approves it, a dead-zone retry does not create a second copy,
 * and a typo near an existing place is caught before a moderator has to.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("place submission", () => {
  const prefix = `submit-${crypto.randomUUID().slice(0, 8)}`;
  const town = `${prefix}-town`;
  const elsewhere = `${prefix}-elsewhere`;
  const placeCategory = `${prefix}-place`;
  const businessCategory = `${prefix}-business`;
  const caseCategory = `${prefix}-case`;
  let guarded = false;
  const accountIds: string[] = [];

  function square(west: number, south: number): string {
    const east = west + 0.01;
    const north = south + 0.01;
    return `SRID=4326;MULTIPOLYGON(((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south})))`;
  }

  function input(overrides: Partial<SubmitPlaceInput> = {}): SubmitPlaceInput {
    return {
      requestId: crypto.randomUUID(),
      name: `Farmacia ${crypto.randomUUID().slice(0, 8)}`,
      description: "Una farmacia sintética para probar el alta de lugares.",
      address: "Calle Duarte 1",
      categoryId: placeCategory,
      location: { lng: 10.005, lat: 10.005 },
      locationSource: "map",
      ...overrides,
    };
  }

  beforeAll(async () => {
    assertDedicatedLocalDatabase();
    guarded = true;
    await db.insert(municipalities).values([
      { id: town, name: "Synthetic submission town", boundary: square(10, 10) },
      {
        id: elsewhere,
        name: "Synthetic neighbouring town",
        boundary: square(20, 20),
      },
    ]);
    await db.insert(categories).values([
      { id: placeCategory, kind: "place", name: "Lugares" },
      { id: businessCategory, kind: "business", name: "Negocios" },
      { id: caseCategory, kind: "consultation", name: "Casos" },
    ]);
  });

  afterAll(async () => {
    if (!guarded) return;
    await db.delete(places).where(eq(places.municipalityId, town));
    await db.delete(places).where(eq(places.municipalityId, elsewhere));
    await db
      .delete(categories)
      .where(
        inArray(categories.id, [placeCategory, businessCategory, caseCategory]),
      );
    if (accountIds.length > 0) {
      await db.delete(user).where(inArray(user.id, accountIds));
    }
    await db
      .delete(municipalities)
      .where(inArray(municipalities.id, [town, elsewhere]));
  });

  test("a member submits a pending place, and the trail records it", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);

    const created = await submitPlace(member.viewer, input());
    const [row] = await db
      .select()
      .from(places)
      .where(eq(places.id, created.id))
      .limit(1);

    expect(row?.status).toBe("pending");
    expect(row?.municipalityId).toBe(town);
    expect(row?.createdByUserId).toBe(member.id);
    expect(row?.slug.startsWith("farmacia-")).toBe(true);
    expect(row?.location).toEqual({ x: 10.005, y: 10.005 });

    const trail = await auditsFor(member.id, "place.submitted");
    expect(trail.map((event) => event.subjectId)).toContain(created.id);
  });

  test("a retried request returns the first result instead of a second place", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);
    const request = input();

    const first = await submitPlace(member.viewer, request);
    const retry = await submitPlace(member.viewer, request);

    expect(retry.id).toBe(first.id);
    const rows = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.municipalityId, town));
    expect(rows.filter((row) => row.id === first.id)).toHaveLength(1);
  });

  test("a near-identical place in the same spot is refused as a duplicate", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);
    const name = `Colmado Central ${crypto.randomUUID().slice(0, 6)}`;

    await submitPlace(member.viewer, input({ name }));
    await expect(
      submitPlace(
        member.viewer,
        input({
          name: name.replace("Central", "Sentral"),
          location: { lng: 10.0051, lat: 10.0051 },
        }),
      ),
    ).rejects.toBeInstanceOf(PlaceSubmissionError);
  });

  test("a category of the wrong kind, or a point outside the province, is refused", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);

    await expect(
      submitPlace(member.viewer, input({ categoryId: caseCategory })),
    ).rejects.toMatchObject({ reason: "invalid_category" });

    await expect(
      submitPlace(
        member.viewer,
        input({ location: { lng: -70.9, lat: 19.2 } }),
      ),
    ).rejects.toMatchObject({ reason: "outside_province" });
  });

  test("a business category captures the contact details; a place category refuses them", async () => {
    const member = await createMember(prefix);
    accountIds.push(member.id);

    const business = await submitPlace(
      member.viewer,
      input({
        categoryId: businessCategory,
        business: {
          contactPhone: "809-555-1212",
          whatsapp: "18095551212",
          openingHours: "8:00 a 5:00",
        },
      }),
    );
    const [row] = await db
      .select({ details: places.businessDetails })
      .from(places)
      .where(eq(places.id, business.id))
      .limit(1);
    expect(row?.details?.contactPhone).toBe("809-555-1212");

    await expect(
      submitPlace(
        member.viewer,
        input({
          business: {
            contactPhone: "809-555-1212",
            whatsapp: "",
            openingHours: "",
          },
        }),
      ),
    ).rejects.toMatchObject({ reason: "invalid_category" });
  });
});
