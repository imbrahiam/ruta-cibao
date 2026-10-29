import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  consultationResponses,
  consultations,
  consultationVotes,
  municipalities,
  notifications,
  realtimeEvents,
  user,
} from "@/db/schema";
import { requireModerator } from "@/modules/access/permissions";
import type { MemberViewer } from "@/modules/access/viewer";
import {
  openConsultation,
  supportConsultation,
} from "@/modules/consultations/open-consultation";
import { respondToConsultation } from "@/modules/consultations/respond";
import { decidePublication } from "@/modules/moderation/decide";
import {
  assertDedicatedLocalDatabase,
  auditsFor,
  createMember,
} from "./support/test-db";

/**
 * The consultation loop end to end: a resident opens a case, a neighbour backs
 * it, the municipality answers it, and the author is told. Each step has a
 * promise the citizen can feel, and each one writes a row plus a trail plus a
 * notification that the other steps depend on.
 */
describe.skipIf(process.env.RUN_DB_TESTS !== "1")("consultations", () => {
  const prefix = `case-${crypto.randomUUID().slice(0, 8)}`;
  const town = `${prefix}-town`;
  const neighbourTown = `${prefix}-neighbour`;
  const caseCategory = `${prefix}-category`;
  let guarded = false;
  const accountIds: string[] = [];

  function square(west: number, south: number): string {
    const east = west + 0.01;
    const north = south + 0.01;
    return `SRID=4326;MULTIPOLYGON(((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south})))`;
  }

  const resident = async () => {
    const member = await createMember(prefix, { municipalityId: town });
    accountIds.push(member.id);
    return member.viewer;
  };

  const moderator = async (municipalityId = town) => {
    const member = await createMember(prefix, {
      municipalityId,
      staff: { role: "moderator", municipalityId },
    });
    accountIds.push(member.id);
    return requireModerator(member.viewer);
  };

  const open = (
    viewer: MemberViewer,
    overrides: Partial<Parameters<typeof openConsultation>[1]> = {},
  ) =>
    openConsultation(viewer, {
      requestId: crypto.randomUUID(),
      categoryId: caseCategory,
      title: "El agua llega salada al barrio",
      body: "Desde hace tres semanas el agua que sale del grifo tiene sal. Afecta a varias casas de la calle Duarte y nadie del ayuntamiento ha respondido todavía.",
      municipalityId: town,
      location: { lng: 10.005, lat: 10.005 },
      ...overrides,
    });

  const publish = (viewer: Awaited<ReturnType<typeof moderator>>, id: string) =>
    decidePublication(viewer, {
      requestId: crypto.randomUUID(),
      target: { kind: "consultation", ref: id },
      status: "published",
    });

  beforeAll(async () => {
    assertDedicatedLocalDatabase();
    guarded = true;
    await db.insert(municipalities).values([
      { id: town, name: "Synthetic case town", boundary: square(10, 10) },
      {
        id: neighbourTown,
        name: "Synthetic neighbouring town",
        boundary: square(20, 20),
      },
    ]);
    await db.insert(categories).values({
      id: caseCategory,
      kind: "consultation",
      name: "Casos vecinales",
    });
  });

  afterAll(async () => {
    if (!guarded) return;
    await db
      .delete(consultations)
      .where(inArray(consultations.municipalityId, [town, neighbourTown]));
    await db.delete(categories).where(eq(categories.id, caseCategory));
    if (accountIds.length > 0) {
      await db.delete(user).where(inArray(user.id, accountIds));
    }
    await db
      .delete(municipalities)
      .where(inArray(municipalities.id, [town, neighbourTown]));
  });

  test("a resident opens a pending case and is its first supporter", async () => {
    const author = await resident();
    const created = await open(author);

    const [row] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, created.id))
      .limit(1);
    expect(row?.publicationStatus).toBe("pending");
    expect(row?.status).toBe("open");
    expect(row?.municipalityId).toBe(town);
    expect(row?.openedByUserId).toBe(author.userId);

    const votes = await db
      .select({ userId: consultationVotes.userId })
      .from(consultationVotes)
      .where(eq(consultationVotes.consultationId, created.id));
    expect(votes).toEqual([{ userId: author.userId }]);

    const trail = await auditsFor(author.userId, "consultation.opened");
    expect(trail.map((event) => event.subjectId)).toContain(created.id);
  });

  test("a second tap on open returns the first case, not another", async () => {
    const author = await resident();
    const request = {
      requestId: crypto.randomUUID(),
      categoryId: caseCategory,
      title: "La basura no se recoge desde el lunes",
      body: "El camión no ha pasado por la calle Duarte desde el lunes y hay bolsas acumuladas en la esquina. Varias familias han tenido que moverlas.",
      municipalityId: town,
    };

    const first = await openConsultation(author, request);
    const retry = await openConsultation(author, request);
    expect(retry.id).toBe(first.id);
  });

  test("a point in another municipality is refused and names where it is", async () => {
    const author = await resident();
    await expect(
      open(author, { location: { lng: 20.005, lat: 20.005 } }),
    ).rejects.toMatchObject({
      reason: "municipality_mismatch",
      pointMunicipalityId: neighbourTown,
    });

    await expect(
      open(author, { location: { lng: 30, lat: 30 } }),
    ).rejects.toMatchObject({ reason: "outside_province" });

    await expect(
      open(author, { categoryId: "no-existe" }),
    ).rejects.toMatchObject({ reason: "invalid_category" });
  });

  test("a pending case is invisible to neighbours until staff publish it", async () => {
    const author = await resident();
    const neighbour = await resident();
    const staff = await moderator();
    const created = await open(author);

    await expect(
      supportConsultation(db, neighbour, {
        consultationId: created.id,
        supported: true,
      }),
    ).rejects.toMatchObject({ reason: "not_found" });

    const own = await supportConsultation(db, author, {
      consultationId: created.id,
      supported: false,
    });
    expect(own.supportCount).toBe(0);
    const again = await supportConsultation(db, author, {
      consultationId: created.id,
      supported: true,
    });
    expect(again.supportCount).toBe(1);

    await publish(staff, created.id);

    const supported = await supportConsultation(db, neighbour, {
      consultationId: created.id,
      supported: true,
    });
    expect(supported).toEqual({ supported: true, supportCount: 2 });
    const withdrawn = await supportConsultation(db, neighbour, {
      consultationId: created.id,
      supported: false,
    });
    expect(withdrawn).toEqual({ supported: false, supportCount: 1 });

    const [published] = await db
      .select({ publicationStatus: consultations.publicationStatus })
      .from(consultations)
      .where(eq(consultations.id, created.id));
    expect(published?.publicationStatus).toBe("published");

    const events = await db
      .select({ action: realtimeEvents.action })
      .from(realtimeEvents)
      .where(
        and(
          eq(realtimeEvents.subjectType, "consultation"),
          eq(realtimeEvents.subjectId, created.id),
        ),
      );
    expect(events.map((event) => event.action)).toContain("created");
  });

  test("the municipality answers once, moves the case, and tells the author", async () => {
    const author = await resident();
    const staff = await moderator();
    const created = await open(author);
    await publish(staff, created.id);

    const requestId = crypto.randomUUID();
    const answer = {
      requestId,
      consultationId: created.id,
      body: "El equipo de Obras Públicas revisó la línea y programó la reparación para el viernes.",
      statusAfter: "answered" as const,
    };
    await respondToConsultation(staff, answer);
    await respondToConsultation(staff, answer);

    const replies = await db
      .select()
      .from(consultationResponses)
      .where(eq(consultationResponses.consultationId, created.id));
    expect(replies).toHaveLength(1);

    const [row] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, created.id));
    expect(row?.status).toBe("answered");
    expect(row?.answeredAt).not.toBeNull();

    const firstNotice = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, author.userId),
          eq(notifications.messageKey, "notifications.consultationAnswered"),
        ),
      );
    expect(firstNotice).toHaveLength(1);
    expect(firstNotice[0]?.href).toContain(created.slug);

    const trail = await auditsFor(staff.userId, "consultation.answered");
    expect(trail.map((event) => event.subjectId)).toContain(created.id);

    await respondToConsultation(staff, {
      requestId: crypto.randomUUID(),
      consultationId: created.id,
      body: "La reparación quedó terminada y verificada con los vecinos.",
      statusAfter: "resolved",
    });

    const moved = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, author.userId),
          eq(
            notifications.messageKey,
            "notifications.consultationStatusChanged",
          ),
        ),
      );
    expect(moved).toHaveLength(1);
    const [closed] = await db
      .select({
        status: consultations.status,
        closedAt: consultations.closedAt,
      })
      .from(consultations)
      .where(eq(consultations.id, created.id));
    expect(closed?.status).toBe("resolved");
    expect(closed?.closedAt).not.toBeNull();

    await expect(
      supportConsultation(db, author, {
        consultationId: created.id,
        supported: true,
      }),
    ).rejects.toMatchObject({ reason: "closed" });
  });

  test("a moderator from another municipality cannot answer", async () => {
    const author = await resident();
    const outsider = await moderator(neighbourTown);
    const created = await open(author);

    await expect(
      respondToConsultation(outsider, {
        requestId: crypto.randomUUID(),
        consultationId: created.id,
        body: "Una respuesta que no le corresponde a este municipio.",
        statusAfter: "answered",
      }),
    ).rejects.toMatchObject({ data: { reason: "municipality_scope" } });
  });

  test("hiding a case closes it to staff replies and the public", async () => {
    const author = await resident();
    const staff = await moderator();
    const created = await open(author);
    await publish(staff, created.id);

    await decidePublication(staff, {
      requestId: crypto.randomUUID(),
      target: { kind: "consultation", ref: created.id },
      status: "hidden",
      reason: "El caso contiene datos personales de un vecino.",
    });

    await expect(
      respondToConsultation(staff, {
        requestId: crypto.randomUUID(),
        consultationId: created.id,
        body: "Esta respuesta no debería llegar a ninguna parte.",
        statusAfter: "answered",
      }),
    ).rejects.toMatchObject({ reason: "not_found" });

    const trail = await auditsFor(staff.userId, "consultation.hidden");
    expect(trail.map((event) => event.subjectId)).toContain(created.id);
  });

  test("the database refuses a second vote row for the same account", async () => {
    const author = await resident();
    const created = await open(author);
    await expect(
      (async () => {
        await db
          .insert(consultationVotes)
          .values({ consultationId: created.id, userId: author.userId });
      })(),
    ).rejects.toThrow();
  });
});
