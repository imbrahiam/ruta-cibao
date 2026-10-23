import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
import { call } from "@orpc/server";
import { offlineSnapshotSchema } from "@ruta/contracts";
import { eq, inArray } from "drizzle-orm";
import { GET as getSnapshotRoute } from "@/app/api/offline/snapshots/[version]/route";
import { db } from "@/db";
import {
  businessClaims,
  categories,
  ecoRoutes,
  municipalities,
  offlineSnapshots,
  placePhotos,
  places,
  roads,
  user,
} from "@/db/schema";
import { deleteObject, listObjectKeys } from "@/lib/storage";
import {
  buildOfflineSnapshot,
  revokeOfflineSnapshots,
  SNAPSHOT_PREFIX,
} from "@/modules/offline/snapshot";
import { offlineRouter } from "@/orpc/routers/offline";
import {
  assertDedicatedLocalDatabase,
  assertDedicatedLocalStorage,
  context,
  createMember,
} from "./support/test-db";

mock.module("@/lib/web-cache", () => ({
  refreshPublicCaches: async () => true,
  PUBLIC_CACHE_TAGS: [],
  internalToken: () => "test",
  isInternalToken: () => false,
}));

describe.skipIf(
  process.env.RUN_DB_TESTS !== "1" || process.env.RUN_STORAGE_TESTS !== "1",
)("offline snapshots and manifest", () => {
  const prefix = `offline-test-${crypto.randomUUID().slice(0, 8)}`;
  const town = `${prefix}-town`;
  const placeCategory = `${prefix}-place`;
  const bizCategory = `${prefix}-biz`;
  const routeCategory = `${prefix}-route`;
  const roadId = `${prefix}-road`;
  const accounts: string[] = [];
  let publishedPlaceId = "";
  let pendingPlaceId = "";
  let publishedPhotoId = "";
  let pendingPhotoId = "";
  let publishedRouteId = "";
  let pendingRouteId = "";
  let guarded = false;

  beforeAll(async () => {
    assertDedicatedLocalDatabase();
    assertDedicatedLocalStorage();
    guarded = true;

    await db.insert(municipalities).values({
      id: town,
      name: `Municipio ${prefix}`,
    });
    await db.insert(categories).values([
      {
        id: placeCategory,
        kind: "place",
        name: `${prefix} place`,
        icon: "map-pin",
        color: "#111111",
        sortOrder: 1,
        isActive: true,
      },
      {
        id: bizCategory,
        kind: "business",
        name: `${prefix} biz`,
        icon: "store",
        color: "#222222",
        sortOrder: 2,
        isActive: true,
      },
      {
        id: routeCategory,
        kind: "route",
        name: `${prefix} route`,
        icon: "route",
        color: "#333333",
        sortOrder: 3,
        isActive: true,
      },
    ]);

    const author = await createMember(prefix, { municipalityId: town });
    const owner = await createMember(prefix, { municipalityId: town });
    accounts.push(author.id, owner.id);

    const [pubPlace] = await db
      .insert(places)
      .values({
        slug: `${prefix}-published-biz`,
        name: `Colmado ${prefix}`,
        description: "Published business for offline test",
        address: "Calle Principal 1",
        imageUrl: "private-object-key-should-not-leak.webp",
        categoryId: bizCategory,
        municipalityId: town,
        location: { x: -71.34, y: 19.47 },
        status: "published",
        createdByUserId: author.id,
        publishedAt: new Date(),
      })
      .returning({ id: places.id });
    publishedPlaceId = pubPlace?.id ?? "";

    const [pendPlace] = await db
      .insert(places)
      .values({
        slug: `${prefix}-pending-place`,
        name: `Secreto ${prefix}`,
        description: "Pending place must not enter offline snapshot",
        categoryId: placeCategory,
        municipalityId: town,
        location: { x: -71.35, y: 19.48 },
        status: "pending",
        createdByUserId: author.id,
      })
      .returning({ id: places.id });
    pendingPlaceId = pendPlace?.id ?? "";

    const [pubPhoto] = await db
      .insert(placePhotos)
      .values({
        placeId: publishedPlaceId,
        uploadedByUserId: author.id,
        storageKey: `${prefix}/published-photo.webp`,
        status: "published",
      })
      .returning({ id: placePhotos.id });
    publishedPhotoId = pubPhoto?.id ?? "";

    const [pendPhoto] = await db
      .insert(placePhotos)
      .values({
        placeId: publishedPlaceId,
        uploadedByUserId: author.id,
        storageKey: `${prefix}/pending-photo.webp`,
        status: "pending",
      })
      .returning({ id: placePhotos.id });
    pendingPhotoId = pendPhoto?.id ?? "";

    await db.insert(businessClaims).values({
      placeId: publishedPlaceId,
      claimantUserId: owner.id,
      evidence: "Private RNC and ownership evidence must never leak",
      contactPhone: "+18095550199",
      whatsapp: "+18295550199",
      openingHours: "Lun-Sab 8am-6pm",
      status: "approved",
    });

    const [pubRoute] = await db
      .insert(ecoRoutes)
      .values({
        name: `Sendero ${prefix}`,
        description:
          "Published route description for offline test with enough chars",
        categoryId: routeCategory,
        municipalityId: town,
        path: [
          { x: -71.34, y: 19.47 },
          { x: -71.33, y: 19.46 },
        ],
        distanceMeters: 1500,
        durationMinutes: 45,
        difficulty: "moderate",
        services: ["water", "guide"],
        status: "published",
        submittedByUserId: author.id,
        reviewNote: "Internal moderator note should not appear in snapshot",
      })
      .returning({ id: ecoRoutes.id });
    publishedRouteId = pubRoute?.id ?? "";

    const [pendRoute] = await db
      .insert(ecoRoutes)
      .values({
        name: `Sendero Pendiente ${prefix}`,
        description:
          "Pending route description for offline test with enough chars",
        categoryId: routeCategory,
        municipalityId: town,
        path: [
          { x: -71.34, y: 19.47 },
          { x: -71.32, y: 19.45 },
        ],
        distanceMeters: 1800,
        durationMinutes: 60,
        difficulty: "hard",
        services: [],
        status: "pending",
        submittedByUserId: author.id,
      })
      .returning({ id: ecoRoutes.id });
    pendingRouteId = pendRoute?.id ?? "";

    await db.insert(roads).values({
      id: roadId,
      name: `Carretera ${prefix}`,
      kind: "primary",
      path: [
        { x: -71.34, y: 19.47 },
        { x: -71.33, y: 19.47 },
      ],
    });
  });

  afterAll(async () => {
    if (!guarded) return;
    const keys = await listObjectKeys(SNAPSHOT_PREFIX);
    for (const key of keys) {
      await deleteObject(key).catch(() => {});
    }
    await db.delete(offlineSnapshots);
    await db.delete(roads).where(eq(roads.id, roadId));
    await db
      .delete(ecoRoutes)
      .where(inArray(ecoRoutes.id, [publishedRouteId, pendingRouteId]));
    await db
      .delete(places)
      .where(inArray(places.id, [publishedPlaceId, pendingPlaceId]));
    await db.delete(user).where(inArray(user.id, accounts));
    await db
      .delete(categories)
      .where(
        inArray(categories.id, [placeCategory, bizCategory, routeCategory]),
      );
    await db.delete(municipalities).where(eq(municipalities.id, town));
  });

  test("builds a schema v1 snapshot of first-party published data only and serves it with no-store", async () => {
    const built = await buildOfflineSnapshot();
    const manifest = await call(offlineRouter.manifest, undefined, {
      context: context({ kind: "anonymous" }),
    });

    expect(manifest.version).toBe(built.version);
    expect(manifest.snapshotSha256).toBe(built.sha256);
    expect(manifest.snapshotBytes).toBe(built.sizeBytes);
    expect(manifest.bounds).toHaveLength(4);
    expect(manifest.snapshotUrl).toContain(
      `/api/offline/snapshots/${built.version}`,
    );

    const response = await getSnapshotRoute(new Request(manifest.snapshotUrl), {
      params: Promise.resolve({ version: built.version }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const rawBytes = new Uint8Array(await response.arrayBuffer());
    expect(rawBytes.byteLength).toBe(manifest.snapshotBytes);
    expect(createHash("sha256").update(rawBytes).digest("hex")).toBe(
      manifest.snapshotSha256,
    );

    const parsed = offlineSnapshotSchema.parse(
      JSON.parse(new TextDecoder().decode(rawBytes)),
    );
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.version).toBe(built.version);

    const place = parsed.places.find((item) => item.id === publishedPlaceId);
    expect(place).toBeDefined();
    expect(place?.imageUrl).toBeNull();
    expect(place?.photoIds).toEqual([publishedPhotoId]);
    expect(place?.photoIds).not.toContain(pendingPhotoId);
    expect(place?.business).toEqual({
      claimed: true,
      contactPhone: "809-555-0199",
      whatsapp: "829-555-0199",
      openingHours: "Lun-Sab 8am-6pm",
    });
    expect(
      parsed.places.find((item) => item.id === pendingPlaceId),
    ).toBeUndefined();

    const route = parsed.routes.find((item) => item.id === publishedRouteId);
    expect(route).toBeDefined();
    expect(route?.reviewNote).toBeNull();
    expect(
      parsed.routes.find((item) => item.id === pendingRouteId),
    ).toBeUndefined();

    const road = parsed.roads.find((item) => item.id === roadId);
    expect(road).toEqual({
      id: roadId,
      name: `Carretera ${prefix}`,
      kind: "primary",
      path: [
        { lng: -71.34, lat: 19.47 },
        { lng: -71.33, lat: 19.47 },
      ],
    });

    const rawText = new TextDecoder().decode(rawBytes);
    expect(rawText).not.toContain("Private RNC and ownership evidence");
    expect(rawText).not.toContain("private-object-key-should-not-leak");
    for (const accountId of accounts) {
      expect(rawText).not.toContain(accountId);
    }
  });

  test("revokes affected versions with 410 on abuse/privacy removal and pauses manifest until replacement succeeds", async () => {
    const initial = await buildOfflineSnapshot();

    await revokeOfflineSnapshots("content_report_actioned");

    const revokedResponse = await getSnapshotRoute(
      new Request(
        `http://localhost:3000/api/offline/snapshots/${initial.version}`,
      ),
      { params: Promise.resolve({ version: initial.version }) },
    );
    expect(revokedResponse.status).toBe(410);
    expect(revokedResponse.headers.get("cache-control")).toBe("no-store");

    await expect(
      call(offlineRouter.manifest, undefined, {
        context: context({ kind: "anonymous" }),
      }),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      data: { reason: "snapshot_unavailable" },
    });

    const replacement = await buildOfflineSnapshot();
    expect(replacement.version).not.toBe(initial.version);

    const manifestAfter = await call(offlineRouter.manifest, undefined, {
      context: context({ kind: "anonymous" }),
    });
    expect(manifestAfter.version).toBe(replacement.version);

    const stillRevoked = await getSnapshotRoute(
      new Request(
        `http://localhost:3000/api/offline/snapshots/${initial.version}`,
      ),
      { params: Promise.resolve({ version: initial.version }) },
    );
    expect(stillRevoked.status).toBe(410);

    const missing = await getSnapshotRoute(
      new Request(
        "http://localhost:3000/api/offline/snapshots/v1-does-not-exist",
      ),
      { params: Promise.resolve({ version: "v1-does-not-exist" }) },
    );
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });
});
