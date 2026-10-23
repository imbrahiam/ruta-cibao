import { ORPCError } from "@orpc/server";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type Db, db } from "@/db";
import { categories, ecoRoutes, municipalities } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { withIdempotency } from "@/lib/idempotency";
import { publishRealtimeEvent } from "@/lib/realtime";
import {
  assertModerates,
  type ModeratorViewer,
  requireMember,
  requireModerator,
} from "@/modules/access/permissions";
import type { MemberViewer, Viewer } from "@/modules/access/viewer";
import { notify } from "@/modules/notifications/notify";
import {
  type BrowseRoutesInput,
  type DecideRouteInput,
  routeOutput,
  type SubmitRouteInput,
} from "./contracts";

export async function submitRoute(
  viewer: MemberViewer,
  input: SubmitRouteInput,
) {
  const outcome = await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [category] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, input.categoryId),
            eq(categories.kind, "route"),
            eq(categories.isActive, true),
          ),
        );
      if (!category)
        throw new ORPCError("BAD_REQUEST", {
          data: { reason: "invalid_category" },
        });
      const geojson = JSON.stringify({
        type: "LineString",
        coordinates: input.path.map(({ lng, lat }) => [lng, lat]),
      });
      const geometry = sql`ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)`;
      const [area] = await tx
        .select({ id: municipalities.id })
        .from(municipalities)
        .where(
          sql`ST_Covers(${municipalities.boundary}, ST_StartPoint(${geometry}))`,
        )
        .orderBy(municipalities.id)
        .limit(1);
      const result = await tx.execute<{ inside: boolean; meters: number }>(
        sql`select ST_CoveredBy(${geometry}, (select ST_Union(boundary) from municipalities)) as inside, round(ST_Length(${geometry}::geography))::int as meters`,
      );
      const measured = result.rows[0];
      if (!area || !measured?.inside)
        throw new ORPCError("BAD_REQUEST", {
          data: { reason: "outside_province" },
        });
      if (measured.meters < 10 || measured.meters > 200000)
        throw new ORPCError("BAD_REQUEST", {
          data: { reason: "invalid_distance" },
        });
      const [created] = await tx
        .insert(ecoRoutes)
        .values({
          name: input.name,
          description: input.description,
          categoryId: input.categoryId,
          municipalityId: area.id,
          path: input.path.map(({ lng, lat }) => ({ x: lng, y: lat })),
          distanceMeters: measured.meters,
          durationMinutes: input.durationMinutes,
          difficulty: input.difficulty,
          services: input.services,
          submittedByUserId: viewer.userId,
        })
        .returning({ id: ecoRoutes.id });
      if (!created) throw new Error("Route insert returned no row");
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "route.submitted",
          subjectType: "route",
          subjectId: created.id,
          municipalityId: area.id,
        },
        tx,
      );
      return { id: created.id, status: "pending" as const };
    },
  });
  return outcome.result;
}

export async function browseRoutes(
  executor: Db,
  viewer: Viewer,
  input: BrowseRoutesInput,
) {
  let visibility = eq(ecoRoutes.status, "published");
  if (input.scope === "mine")
    visibility = eq(ecoRoutes.submittedByUserId, requireMember(viewer).userId);
  if (input.scope === "pending") {
    const moderator = requireModerator(viewer);
    visibility =
      and(
        eq(ecoRoutes.status, "pending"),
        moderator.scope === "all"
          ? undefined
          : inArray(ecoRoutes.municipalityId, [...moderator.scope]),
      ) ?? visibility;
  }
  const where = and(
    visibility,
    input.municipalityId
      ? eq(ecoRoutes.municipalityId, input.municipalityId)
      : undefined,
    input.difficulty ? eq(ecoRoutes.difficulty, input.difficulty) : undefined,
  );
  const [rows, [count]] = await Promise.all([
    executor
      .select({
        route: ecoRoutes,
        categoryName: categories.name,
        municipalityName: municipalities.name,
      })
      .from(ecoRoutes)
      .innerJoin(categories, eq(categories.id, ecoRoutes.categoryId))
      .innerJoin(
        municipalities,
        eq(municipalities.id, ecoRoutes.municipalityId),
      )
      .where(where)
      .orderBy(desc(ecoRoutes.createdAt), ecoRoutes.id)
      .limit(input.limit)
      .offset(input.offset),
    executor
      .select({ total: sql<number>`count(*)::int` })
      .from(ecoRoutes)
      .where(where),
  ]);
  return {
    items: rows.map(({ route, categoryName, municipalityName }) =>
      routeOutput.parse({
        ...route,
        categoryName,
        municipalityName,
        path: route.path.map(({ x, y }) => ({ lng: x, lat: y })),
        createdAt: route.createdAt.toISOString(),
      }),
    ),
    total: count?.total ?? 0,
  };
}

export async function routeDetail(viewer: Viewer, id: string) {
  const [row] = await db
    .select({
      route: ecoRoutes,
      categoryName: categories.name,
      municipalityName: municipalities.name,
    })
    .from(ecoRoutes)
    .innerJoin(categories, eq(categories.id, ecoRoutes.categoryId))
    .innerJoin(municipalities, eq(municipalities.id, ecoRoutes.municipalityId))
    .where(eq(ecoRoutes.id, id))
    .limit(1);
  if (!row) throw new ORPCError("NOT_FOUND");
  if (
    row.route.status !== "published" &&
    (viewer.kind === "anonymous" ||
      row.route.submittedByUserId !== viewer.userId)
  )
    assertModerates(requireModerator(viewer), row.route.municipalityId);
  return routeOutput.parse({
    ...row.route,
    categoryName: row.categoryName,
    municipalityName: row.municipalityName,
    path: row.route.path.map(({ x, y }) => ({ lng: x, lat: y })),
    createdAt: row.route.createdAt.toISOString(),
  });
}

export async function decideRoute(
  viewer: ModeratorViewer,
  input: DecideRouteInput,
) {
  await withIdempotency({
    key: input.requestId,
    userId: viewer.userId,
    request: input,
    run: async (tx) => {
      const [route] = await tx
        .select()
        .from(ecoRoutes)
        .where(eq(ecoRoutes.id, input.id))
        .for("update");
      if (!route) throw new ORPCError("NOT_FOUND");
      assertModerates(viewer, route.municipalityId);
      if (route.status !== "pending") throw new ORPCError("CONFLICT");
      await tx
        .update(ecoRoutes)
        .set({
          status: input.status,
          reviewNote: input.note,
          reviewedAt: new Date(),
        })
        .where(eq(ecoRoutes.id, route.id));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: `route.${input.status}`,
          subjectType: "route",
          subjectId: route.id,
          municipalityId: route.municipalityId,
        },
        tx,
      );
      await publishRealtimeEvent(
        {
          channel: "routes",
          municipalityId: route.municipalityId,
          subjectType: "route",
          subjectId: route.id,
          action: "updated",
        },
        tx,
      );
      if (route.submittedByUserId)
        await notify(
          {
            userId: route.submittedByUserId,
            messageKey: "notifications.routeReviewed",
            href: `/rutas?ver=mias&ruta=${input.id}`,
            channels: { push: true, email: false },
          },
          tx,
        );
      return {
        userId: route.submittedByUserId,
        municipalityId: route.municipalityId,
      };
    },
  });

  return { status: input.status };
}
