import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { call } from "@orpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  accountDeletions,
  auditEvents,
  businessClaims,
  categories,
  consultationPhotos,
  consultationPhotoUploads,
  consultationResponses,
  consultations,
  consultationVotes,
  ecoRoutes,
  municipalities,
  nativePushDevices,
  passportStamps,
  photoUploads,
  placePhotos,
  places,
  savedPlaces,
  session,
  trafficReports,
  user,
  verification,
} from "@/db/schema";
import { encryptSensitive, hashLookup } from "@/lib/crypto";
import { drainOutbox } from "@/lib/jobs/outbox";
import {
  deleteObject,
  getObjectBytes,
  listObjectKeys,
  putObject,
  statObject,
} from "@/lib/storage";
import {
  parseTombstone,
  reapplyDeletionTombstone,
  runAccountDeletion,
} from "@/modules/account/deletion";
import { meRouter } from "@/orpc/routers/me";
import {
  assertDedicatedLocalDatabase,
  assertDedicatedLocalStorage,
  context,
  createMember,
} from "./support/test-db";

// The worker process refreshes web caches over HTTP; there is no web server here.
mock.module("@/lib/web-cache", () => ({
  refreshPublicCaches: async () => true,
  PUBLIC_CACHE_TAGS: [],
  internalToken: () => "test",
  isInternalToken: () => false,
}));

// Opt in with RUN_DB_TESTS=1 and RUN_STORAGE_TESTS=1 against the disposable database and test bucket.
describe.skipIf(
  process.env.RUN_DB_TESTS !== "1" || process.env.RUN_STORAGE_TESTS !== "1",
)("account deletion", () => {
  const prefix = `deletion-test-${crypto.randomUUID().slice(0, 8)}`;
  const town = `${prefix}-town`;
  const placeCategory = `${prefix}-place`;
  const routeCategory = `${prefix}-route`;
  const caseCategory = `${prefix}-case`;
  const trafficCategory = `${prefix}-traffic`;
  const accounts: string[] = [];
  const objectKeys = new Set<string>();
  let guarded = false;

  async function member(options?: Parameters<typeof createMember>[1]) {
    const created = await createMember(prefix, {
      municipalityId: town,
      ...options,
    });
    accounts.push(created.id);
    return created;
  }

  async function object(key: string) {
    objectKeys.add(key);
    await putObject(
      key,
      new TextEncoder().encode("synthetic"),
      "application/octet-stream",
    );
    return key;
  }

  beforeAll(async () => {
    assertDedicatedLocalDatabase();
    assertDedicatedLocalStorage();
    guarded = true;
    await db.insert(municipalities).values({ id: town, name: town });
    await db.insert(categories).values([
      { id: placeCategory, kind: "place", name: `${prefix} place` },
      { id: routeCategory, kind: "route", name: `${prefix} route` },
      { id: caseCategory, kind: "consultation", name: `${prefix} case` },
      { id: trafficCategory, kind: "traffic", name: `${prefix} traffic` },
    ]);
  });

  afterAll(async () => {
    if (!guarded) return;
    for (const key of objectKeys) await deleteObject(key).catch(() => {});
    await db
      .delete(verification)
      .where(eq(verification.id, `${prefix}-other-code`));
    const ledger = await listObjectKeys("deletion-ledger/");
    const mine = await db
      .select({ id: accountDeletions.id })
      .from(accountDeletions)
      .where(inArray(accountDeletions.userId, accounts));
    for (const row of mine) {
      if (ledger.includes(`deletion-ledger/${row.id}.json`))
        await deleteObject(`deletion-ledger/${row.id}.json`);
    }
    await db
      .delete(accountDeletions)
      .where(inArray(accountDeletions.userId, accounts));
    await db
      .delete(consultations)
      .where(eq(consultations.municipalityId, town));
    await db.delete(places).where(eq(places.municipalityId, town));
    await db.delete(ecoRoutes).where(eq(ecoRoutes.municipalityId, town));
    await db
      .delete(trafficReports)
      .where(eq(trafficReports.municipalityId, town));
    await db.delete(auditEvents).where(eq(auditEvents.municipalityId, town));
    await db.delete(user).where(inArray(user.id, accounts));
    await db
      .delete(categories)
      .where(
        inArray(categories.id, [
          placeCategory,
          routeCategory,
          caseCategory,
          trafficCategory,
        ]),
      );
    await db.delete(municipalities).where(eq(municipalities.id, town));
  });

  const stale = {
    id: "stale-session",
    createdAt: new Date(Date.now() - 10 * 60_000),
  };

  test("requires a signed-in verified member with a code entered in the last five minutes", async () => {
    const owner = await member();
    const unverified = await member({ contactVerified: false });
    const input = { requestId: crypto.randomUUID() };
    await expect(
      call(meRouter.requestDeletion, input, {
        context: context({ kind: "anonymous" }),
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      call(meRouter.requestDeletion, input, {
        context: context(unverified.viewer),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "contact_verification_required" },
    });
    await expect(
      call(meRouter.requestDeletion, input, {
        context: context(owner.viewer, stale),
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "recent_authentication_required" },
    });
    expect(
      await db
        .select()
        .from(accountDeletions)
        .where(eq(accountDeletions.userId, owner.id)),
    ).toHaveLength(0);
  });

  test("the last administrator cannot delete the account", async () => {
    // Any other administrator in the shared test database would satisfy the guard.
    const existingAdmins = await db.execute<{ count: number }>(
      `select count(*)::int as count from member_profiles where staff_role = 'admin'` as never,
    );
    if (Number(existingAdmins.rows[0]?.count ?? 0) > 0) return;
    const sole = await member({ staff: { role: "admin" } });
    await expect(
      call(
        meRouter.requestDeletion,
        { requestId: crypto.randomUUID() },
        { context: context(sole.viewer) },
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      data: { reason: "last_administrator" },
    });
    const second = await member({ staff: { role: "admin" } });
    const done = await call(
      meRouter.requestDeletion,
      { requestId: crypto.randomUUID() },
      { context: context(sole.viewer) },
    );
    expect(done.status).toBe("pending");
    void second;
  });

  test("deleting removes what the person contributed, keeps what the institution answered, and is repeatable", async () => {
    const owner = await member();
    const maintainer = await member();
    const staff = await member({
      staff: { role: "moderator", municipalityId: town },
    });
    const neighbour = await member();

    const photoKey = await object(`published-photos/${prefix}/own.webp`);
    const tempKey = await object(`photo-uploads/${prefix}/temp.bin`);
    const sharedPhotoKey = await object(
      `published-photos/${prefix}/on-kept-place.webp`,
    );

    // A place only the owner stands behind, with their photograph, and a place a
    // second owner keeps alive.
    const [lone] = await db
      .insert(places)
      .values({
        slug: `${prefix}-lone`,
        name: "Lone synthetic place",
        description: "Owner narrative",
        categoryId: placeCategory,
        municipalityId: town,
        location: { x: -71.3, y: 19.45 },
        status: "published",
        createdByUserId: owner.id,
        imageUrl: photoKey,
      })
      .returning({ id: places.id });
    const [shared] = await db
      .insert(places)
      .values({
        slug: `${prefix}-shared`,
        name: "Shared synthetic place",
        description: "Deleted author's narrative",
        address: "Private address",
        categoryId: placeCategory,
        municipalityId: town,
        location: { x: -71.31, y: 19.46 },
        status: "published",
        createdByUserId: owner.id,
        businessDetails: { phone: "8095550000" } as never,
      })
      .returning({ id: places.id });
    if (!lone || !shared) throw new Error("fixture places missing");
    await db.insert(placePhotos).values([
      {
        placeId: lone.id,
        uploadedByUserId: owner.id,
        storageKey: photoKey,
        status: "published",
      },
      {
        placeId: shared.id,
        uploadedByUserId: owner.id,
        storageKey: sharedPhotoKey,
        status: "published",
      },
    ]);
    await db.insert(photoUploads).values({
      storageKey: tempKey,
      userId: owner.id,
      placeId: lone.id,
      requestId: crypto.randomUUID(),
      requestHash: "synthetic",
      sizeBytes: 9,
      contentType: "image/webp",
      expiresAt: new Date(Date.now() + 600_000),
    });
    await db.insert(businessClaims).values({
      placeId: shared.id,
      claimantUserId: maintainer.id,
      evidence: "Synthetic owner evidence",
      contactPhone: "8095550111",
      status: "approved",
    });
    await db
      .insert(savedPlaces)
      .values({ userId: owner.id, placeId: shared.id });
    await db
      .insert(savedPlaces)
      .values({ userId: neighbour.id, placeId: lone.id });

    const [route] = await db
      .insert(ecoRoutes)
      .values({
        name: `${prefix} route`,
        description: "Synthetic route",
        categoryId: routeCategory,
        municipalityId: town,
        path: [
          { x: -71.3, y: 19.45 },
          { x: -71.31, y: 19.46 },
        ],
        distanceMeters: 1500,
        durationMinutes: 30,
        difficulty: "easy",
        status: "published",
        submittedByUserId: owner.id,
      })
      .returning({ id: ecoRoutes.id });
    const [traffic] = await db
      .insert(trafficReports)
      .values({
        categoryId: trafficCategory,
        municipalityId: town,
        location: { x: -71.3, y: 19.45 },
        description: "Owner text",
        reportedByUserId: owner.id,
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .returning({ id: trafficReports.id });
    const [unanswered] = await db
      .insert(consultations)
      .values({
        slug: `${prefix}-unanswered`,
        categoryId: caseCategory,
        municipalityId: town,
        title: "Unanswered private case",
        body: "Private narrative nobody answered.",
        openedByUserId: owner.id,
        publicationStatus: "published",
      })
      .returning({ id: consultations.id });
    const [answered] = await db
      .insert(consultations)
      .values({
        slug: `${prefix}-answered`,
        categoryId: caseCategory,
        municipalityId: town,
        title: "Answered private case",
        body: "Private narrative with an official answer.",
        openedByUserId: owner.id,
        publicationStatus: "published",
      })
      .returning({ id: consultations.id });
    if (!route || !traffic || !unanswered || !answered)
      throw new Error("fixtures missing");
    await db.insert(consultationResponses).values({
      consultationId: answered.id,
      body: "Official answer that must survive.",
      authorUserId: staff.id,
      statusAfter: "answered",
    });
    await db
      .insert(consultationVotes)
      .values({ consultationId: answered.id, userId: neighbour.id });
    const casePhotoKey = await object(`consultation-photos/${prefix}/own.webp`);
    const caseTempKey = await object(`consultations/${prefix}/temp.bin`);
    await db.insert(consultationPhotos).values({
      consultationId: answered.id,
      storageKey: casePhotoKey,
      width: 10,
      height: 10,
      uploadedByUserId: owner.id,
    });
    await db.insert(consultationPhotoUploads).values({
      storageKey: caseTempKey,
      userId: owner.id,
      consultationId: answered.id,
      requestId: crypto.randomUUID(),
      requestHash: "synthetic",
      sizeBytes: 9,
      contentType: "image/webp",
      expiresAt: new Date(Date.now() + 600_000),
    });
    const ownerEmail = `${owner.id}@example.invalid`;
    const codeExpiry = new Date(Date.now() + 600_000);
    await db.insert(verification).values([
      {
        id: `${prefix}-own-code`,
        identifier: `sign-in-otp-${ownerEmail}`,
        value: "synthetic",
        expiresAt: codeExpiry,
      },
      {
        id: `${prefix}-other-code`,
        identifier: `sign-in-otp-x.${ownerEmail}`,
        value: "synthetic",
        expiresAt: codeExpiry,
      },
    ]);
    await db.insert(passportStamps).values({
      userId: owner.id,
      placeBlindIndex: hashLookup("passport", `${prefix}`),
      placeId: lone.id,
    });
    await db.insert(nativePushDevices).values({
      installationId: crypto.randomUUID(),
      userId: owner.id,
      platform: "ios",
      tokenCiphertext: encryptSensitive("ExpoPushToken[synthetic]"),
      tokenHash: hashLookup("test-token", crypto.randomUUID()),
    });
    await db.insert(session).values({
      id: `${prefix}-session`,
      token: `${prefix}-token`,
      userId: owner.id,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const requestId = crypto.randomUUID();
    const requested = await call(
      meRouter.requestDeletion,
      { requestId },
      { context: context(owner.viewer) },
    );
    expect(requested).toEqual({ deletionId: requestId, status: "pending" });
    // A retry (and a second request id for the same account) returns the same receipt.
    expect(
      await call(
        meRouter.requestDeletion,
        { requestId },
        { context: context(owner.viewer) },
      ),
    ).toEqual(requested);
    expect(
      (
        await call(
          meRouter.requestDeletion,
          { requestId: crypto.randomUUID() },
          { context: context(owner.viewer) },
        )
      ).deletionId,
    ).toBe(requestId);

    // Sessions are revoked and the account is banned straight away; nothing is destroyed yet.
    expect(
      await db.select().from(session).where(eq(session.userId, owner.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(nativePushDevices)
        .where(eq(nativePushDevices.userId, owner.id)),
    ).toHaveLength(0);
    const [banned] = await db
      .select({ banned: user.banned })
      .from(user)
      .where(eq(user.id, owner.id));
    expect(banned?.banned).toBe(true);
    expect(
      await db.select().from(places).where(eq(places.id, lone.id)),
    ).toHaveLength(1);
    expect(
      await call(
        meRouter.deletionStatus,
        { deletionId: requestId },
        { context: context({ kind: "anonymous" }) },
      ),
    ).toEqual({ status: "pending" });
    const [row] = await db
      .select()
      .from(accountDeletions)
      .where(eq(accountDeletions.id, requestId));
    expect(row?.inventoryCiphertext).toBeTruthy();
    expect(row?.inventoryCiphertext).not.toContain("own.webp");

    // Run the queued cleanup (the same job the worker runs), twice: it is repeatable.
    await drainOutbox();
    const first = await runAccountDeletion(requestId);
    expect(first.status).toBe("completed");
    expect(await runAccountDeletion(requestId)).toEqual({
      status: "completed",
    });

    expect(
      await db.select().from(user).where(eq(user.id, owner.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(places).where(eq(places.id, lone.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(ecoRoutes).where(eq(ecoRoutes.id, route.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(trafficReports)
        .where(eq(trafficReports.id, traffic.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(consultations)
        .where(eq(consultations.id, unanswered.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(savedPlaces)
        .where(eq(savedPlaces.userId, owner.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(passportStamps)
        .where(eq(passportStamps.userId, owner.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(photoUploads)
        .where(eq(photoUploads.userId, owner.id)),
    ).toHaveLength(0);
    for (const key of [photoKey, tempKey, sharedPhotoKey])
      expect(await statObject(key)).toBeNull();

    // The case that was answered survives as a redacted shell with the official reply.
    const [shell] = await db
      .select()
      .from(consultations)
      .where(eq(consultations.id, answered.id));
    expect(shell?.slug).toBe(`caso-${answered.id}`);
    expect(
      await db
        .select()
        .from(consultationPhotos)
        .where(eq(consultationPhotos.consultationId, answered.id)),
    ).toHaveLength(0);
    for (const key of [casePhotoKey, caseTempKey])
      expect(await statObject(key)).toBeNull();
    expect(
      (
        await db
          .select({ id: verification.id })
          .from(verification)
          .where(
            inArray(verification.id, [
              `${prefix}-own-code`,
              `${prefix}-other-code`,
            ]),
          )
      ).map((row) => row.id),
    ).toEqual([`${prefix}-other-code`]);
    expect(shell).toMatchObject({
      title: "",
      body: "",
      location: null,
      openedByUserId: null,
      publicationStatus: "hidden",
    });
    expect(
      await db
        .select()
        .from(consultationResponses)
        .where(eq(consultationResponses.consultationId, answered.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(consultationVotes)
        .where(eq(consultationVotes.consultationId, answered.id)),
    ).toHaveLength(1);

    // The place kept alive by another owner keeps its identity, not the author's text, contact or photos.
    const [kept] = await db
      .select()
      .from(places)
      .where(eq(places.id, shared.id));
    expect(kept).toMatchObject({
      name: "Shared synthetic place",
      status: "published",
      createdByUserId: null,
      description: null,
      address: null,
      businessDetails: null,
    });
    expect(
      await db
        .select()
        .from(placePhotos)
        .where(eq(placePhotos.placeId, shared.id)),
    ).toHaveLength(0);
    const [claim] = await db
      .select()
      .from(businessClaims)
      .where(eq(businessClaims.placeId, shared.id));
    expect(claim?.contactPhone).toBe("8095550111");

    // The receipt and a ledger entry with internal ids only survive; the inventory is gone.
    expect(
      await call(
        meRouter.deletionStatus,
        { deletionId: requestId },
        { context: context({ kind: "anonymous" }) },
      ),
    ).toEqual({ status: "completed" });
    const [done] = await db
      .select()
      .from(accountDeletions)
      .where(eq(accountDeletions.id, requestId));
    expect(done).toMatchObject({
      userId: owner.id,
      status: "completed",
      inventoryCiphertext: null,
    });
    const ledger = await listObjectKeys(`deletion-ledger/${requestId}`);
    expect(ledger).toEqual([`deletion-ledger/${requestId}.json`]);
    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.subjectType, "account_deletion"),
          eq(auditEvents.subjectId, requestId),
        ),
      );
    expect(audits.map((event) => event.action).sort()).toEqual([
      "account.deleted",
      "account.deletion_requested",
    ]);
    expect(JSON.stringify(audits)).not.toContain("Owner");

    await expect(
      call(
        meRouter.deletionStatus,
        { deletionId: crypto.randomUUID() },
        { context: context({ kind: "anonymous" }) },
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("a database restored from before the deletion is brought back in line from the ledger", async () => {
    const owner = await member();
    const [kept] = await db
      .insert(places)
      .values({
        slug: `${prefix}-restore`,
        name: "Restored synthetic place",
        categoryId: placeCategory,
        municipalityId: town,
        location: { x: -71.3, y: 19.45 },
        status: "published",
        createdByUserId: owner.id,
      })
      .returning({ id: places.id });
    if (!kept) throw new Error("fixture place missing");
    const requestId = crypto.randomUUID();
    await call(
      meRouter.requestDeletion,
      { requestId },
      { context: context(owner.viewer) },
    );
    await runAccountDeletion(requestId);
    const tombstone = parseTombstone(
      await getObjectBytes(`deletion-ledger/${requestId}.json`),
    );
    expect(tombstone).toMatchObject({
      deletionId: requestId,
      userId: owner.id,
    });
    // The tombstone holds internal ids and a date, nothing about the person.
    expect(Object.keys(tombstone ?? {}).sort()).toEqual([
      "completedAt",
      "deletionId",
      "userId",
      "version",
    ]);

    // Simulate restoring an older backup: the account, its content and no receipt.
    await db.delete(accountDeletions).where(eq(accountDeletions.id, requestId));
    await db.insert(user).values({
      id: owner.id,
      name: "Restored",
      email: `${owner.id}@example.invalid`,
      emailVerified: true,
    });
    await db.insert(places).values({
      slug: `${prefix}-restore-2`,
      name: "Resurrected synthetic place",
      categoryId: placeCategory,
      municipalityId: town,
      location: { x: -71.3, y: 19.45 },
      status: "published",
      createdByUserId: owner.id,
    });

    if (!tombstone) throw new Error("tombstone missing");
    expect((await reapplyDeletionTombstone(tombstone)).status).toBe(
      "reapplied",
    );
    expect(
      await db.select().from(user).where(eq(user.id, owner.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(places)
        .where(eq(places.slug, `${prefix}-restore-2`)),
    ).toHaveLength(0);
    expect((await reapplyDeletionTombstone(tombstone)).status).toBe(
      "already_absent",
    );
    const [receipt] = await db
      .select()
      .from(accountDeletions)
      .where(eq(accountDeletions.id, requestId));
    expect(receipt?.status).toBe("completed");
  });
});
