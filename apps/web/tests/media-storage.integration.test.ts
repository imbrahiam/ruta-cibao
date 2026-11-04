import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { db, pool } from "@/db";
import {
  auditEvents,
  categories,
  memberProfiles,
  municipalities,
  photoUploads,
  placePhotos,
  places,
  rateLimitBuckets,
  user,
} from "@/db/schema";
import { hashLookup } from "@/lib/crypto";
import { env } from "@/lib/env";
import {
  checkStorage,
  deleteObject,
  getObjectBytes,
  listObjectKeys,
  putObject,
  statObject,
} from "@/lib/storage";
import { requireMember } from "@/modules/access/permissions";
import { type MemberViewer, toViewer } from "@/modules/access/viewer";
import {
  attachPhoto,
  cleanupPhotoUploads,
  placePhotoUrls,
  requestPhotoUpload,
} from "@/modules/places/photos";

// Run only against a migrated, disposable local database and private test bucket:
// RUN_STORAGE_TESTS=1 bun test apps/web/tests/media-storage.integration.test.ts
// Both the database and bucket names must contain a delimited "test" or "tests".
// Never use the application's normal development database or residents' data.
function assertDedicatedLocalEnvironment() {
  const database = new URL(env.DATABASE_URL);
  const storage = new URL(env.S3_ENDPOINT);
  const localHosts = ["localhost", "127.0.0.1", "[::1]"];
  const testName = /(?:^|[-_])(test|tests)(?:$|[-_])/i;
  if (
    env.NODE_ENV === "production" ||
    !localHosts.includes(database.hostname) ||
    !localHosts.includes(storage.hostname) ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !["http:", "https:"].includes(storage.protocol) ||
    !testName.test(decodeURIComponent(database.pathname.slice(1))) ||
    !testName.test(env.S3_BUCKET) ||
    database.searchParams.has("host") ||
    database.searchParams.has("hostaddr") ||
    !env.S3_FORCE_PATH_STYLE
  ) {
    throw new Error(
      "Storage tests require a non-production loopback PostgreSQL database and path-style S3 test bucket with dedicated test names.",
    );
  }
}

type UploadCommand = {
  requestId: string;
  placeId: string;
  contentType: string;
  sizeBytes: number;
};

describe.skipIf(process.env.RUN_STORAGE_TESTS !== "1")(
  "private photo storage guarantees",
  () => {
    const prefix = `media-test-${crypto.randomUUID()}`;
    const municipalityId = `${prefix}-town`;
    const categoryId = `${prefix}-category`;
    const accountIds: string[] = [];
    const placeIds: string[] = [];
    const objectKeys = new Set<string>();
    const startedAt = Date.now();
    let guarded = false;
    let jpeg: Buffer;

    async function member(
      role: "member" | "resident" | "moderator" = "member",
    ) {
      const id = `${prefix}-${crypto.randomUUID()}`;
      accountIds.push(id);
      await db.insert(user).values({
        id,
        name: "Synthetic media tester",
        email: `${id}@example.invalid`,
      });
      const [profile] = await db
        .insert(memberProfiles)
        .values({
          userId: id,
          displayName: "Synthetic media tester",
          municipalityId,
          residencyVerifiedAt: role === "resident" ? new Date() : null,
          staffRole: role === "moderator" ? "moderator" : "none",
          staffMunicipalityId: role === "moderator" ? municipalityId : null,
        })
        .returning();
      return requireMember(
        toViewer(id, profile, { image: null, contactVerified: true }),
      );
    }

    async function place(
      author: MemberViewer,
      status: "pending" | "published" = "pending",
    ) {
      const id = crypto.randomUUID();
      placeIds.push(id);
      await db.insert(places).values({
        id,
        slug: `${prefix}-${id}`,
        name: "Synthetic media destination",
        categoryId,
        municipalityId,
        location: { x: -71.3, y: 19.45 },
        createdByUserId: author.userId,
        status,
      });
      return id;
    }

    function input(placeId: string, bytes: Uint8Array = jpeg) {
      return {
        requestId: crypto.randomUUID(),
        placeId,
        contentType: "image/jpeg",
        sizeBytes: bytes.byteLength,
      };
    }

    async function reserve(viewer: MemberViewer, command: UploadCommand) {
      const result = await requestPhotoUpload(db, viewer, command);
      objectKeys.add(result.storageKey);
      if (result.status !== "upload" || !result.uploadUrl) {
        throw new Error("Expected an unfinalized upload reservation");
      }
      // An unexpected signed destination must never receive fixture bytes.
      expect(new URL(result.uploadUrl).origin).toBe(
        new URL(env.S3_ENDPOINT).origin,
      );
      return { storageKey: result.storageKey, uploadUrl: result.uploadUrl };
    }

    async function upload(url: string, bytes: Uint8Array = jpeg) {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "image/jpeg" },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(10_000),
      });
      expect(response.ok).toBe(true);
      await response.body?.cancel();
    }

    async function reservation(storageKey: string) {
      const [row] = await db
        .select()
        .from(photoUploads)
        .where(eq(photoUploads.storageKey, storageKey));
      if (!row) throw new Error("Expected persisted upload reservation");
      if (row.finalKey) objectKeys.add(row.finalKey);
      return row;
    }

    async function audits(placeId: string, action: string) {
      return db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.subjectId, placeId),
            eq(auditEvents.action, action),
          ),
        );
    }

    beforeAll(async () => {
      assertDedicatedLocalEnvironment();
      guarded = true;
      await checkStorage();
      await db
        .insert(municipalities)
        .values({ id: municipalityId, name: prefix });
      await db
        .insert(categories)
        .values({ id: categoryId, kind: "place", name: prefix });
      jpeg = await sharp({
        create: {
          width: 24,
          height: 12,
          channels: 3,
          background: { r: 120, g: 70, b: 30 },
        },
      })
        .withExif({
          IFD0: { Artist: "Synthetic test author" },
        })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();
      const metadata = await sharp(jpeg).metadata();
      expect(metadata.exif).toBeDefined();
      expect(metadata.orientation).toBe(6);
    });

    afterAll(async () => {
      if (!guarded) return;
      // Recover keys even if attachment succeeded immediately before an assertion failed.
      if (placeIds.length) {
        const uploads = await db
          .select()
          .from(photoUploads)
          .where(inArray(photoUploads.placeId, placeIds));
        const photos = await db
          .select()
          .from(placePhotos)
          .where(inArray(placePhotos.placeId, placeIds));
        for (const row of uploads) {
          objectKeys.add(row.storageKey);
          if (row.finalKey) objectKeys.add(row.finalKey);
        }
        for (const row of photos) objectKeys.add(row.storageKey);
        for (const placeId of placeIds) {
          for (const key of await listObjectKeys(
            `published-photos/${placeId}/`,
          ))
            objectKeys.add(key);
        }
      }
      for (const key of objectKeys) await deleteObject(key);
      if (placeIds.length) {
        await db
          .delete(auditEvents)
          .where(inArray(auditEvents.subjectId, placeIds));
        await db.delete(places).where(inArray(places.id, placeIds));
      }
      if (accountIds.length) {
        await db
          .delete(auditEvents)
          .where(inArray(auditEvents.actorUserId, accountIds));
        await db.delete(user).where(inArray(user.id, accountIds));
        const keys: string[] = [];
        for (
          let hour = Math.floor(startedAt / 3_600_000);
          hour <= Math.floor(Date.now() / 3_600_000);
          hour++
        ) {
          for (const id of accountIds)
            keys.push(
              hashLookup(
                "rate-limit",
                `photo-upload\0${id}\0${hour * 3_600_000}`,
              ),
            );
        }
        await db
          .delete(rateLimitBuckets)
          .where(inArray(rateLimitBuckets.key, keys));
      }
      await db.delete(categories).where(eq(categories.id, categoryId));
      await db
        .delete(municipalities)
        .where(eq(municipalities.id, municipalityId));
      // The application's shared pool belongs to the runner, not this suite.
    });

    test("only the author can reserve and attach a pending place photo; residency does not publish", async () => {
      const author = await member("resident");
      const stranger = await member();
      const placeId = await place(author);
      const command = input(placeId);
      await expect(
        requestPhotoUpload(db, stranger, command),
      ).rejects.toMatchObject({ reason: "not_found" });
      const reserved = await reserve(author, command);
      await upload(reserved.uploadUrl);
      await expect(
        attachPhoto(db, stranger, { placeId, storageKey: reserved.storageKey }),
      ).rejects.toMatchObject({ reason: "invalid" });
      expect(
        await attachPhoto(db, author, {
          placeId,
          storageKey: reserved.storageKey,
        }),
      ).toEqual({ status: "pending" });
      expect(await placePhotoUrls(db, { kind: "anonymous" }, placeId)).toEqual(
        [],
      );
      const photos = await db
        .select()
        .from(placePhotos)
        .where(eq(placePhotos.placeId, placeId));
      expect(photos).toHaveLength(1);
      expect(photos[0]?.uploadedByUserId).toBe(author.userId);
      expect(photos[0]?.status).toBe("pending");
    });

    test("concurrent identical requests reserve once, audit once, and bind every payload field", async () => {
      const author = await member();
      const placeId = await place(author);
      const command = input(placeId);
      const results = await Promise.all(
        Array.from({ length: 8 }, () => reserve(author, command)),
      );
      expect(new Set(results.map((result) => result.storageKey)).size).toBe(1);
      const rows = await db
        .select()
        .from(photoUploads)
        .where(
          and(
            eq(photoUploads.userId, author.userId),
            eq(photoUploads.requestId, command.requestId),
          ),
        );
      expect(rows).toHaveLength(1);
      expect(await audits(placeId, "place_photo.upload_reserved")).toHaveLength(
        1,
      );
      const otherPlace = await place(author);
      for (const change of [
        { placeId: otherPlace },
        { contentType: "image/png" },
        { sizeBytes: jpeg.length + 1 },
      ]) {
        await expect(
          requestPhotoUpload(db, author, { ...command, ...change }),
        ).rejects.toMatchObject({ reason: "conflict" });
      }
      // UUIDs are owner-scoped, not global capabilities.
      const stranger = await member();
      const publicPlace = await place(author, "published");
      const own = await reserve(author, {
        ...command,
        requestId: crypto.randomUUID(),
        placeId: publicPlace,
      });
      const other = await reserve(stranger, {
        ...command,
        placeId: publicPlace,
      });
      expect(other.storageKey).not.toBe(own.storageKey);
    });

    test("a live reservation renews the same key with a freshly signed usable URL", async () => {
      const author = await member();
      const placeId = await place(author);
      const command = input(placeId);
      const first = await reserve(author, command);
      const nearExpiry = new Date(Date.now() + 60_000);
      await db
        .update(photoUploads)
        .set({ expiresAt: nearExpiry })
        .where(eq(photoUploads.storageKey, first.storageKey));
      // S3 signature timestamps have one-second resolution; no clock/module mocks.
      await Bun.sleep(1100);
      const renewed = await reserve(author, command);
      expect(renewed.storageKey).toBe(first.storageKey);
      expect(renewed.uploadUrl).not.toBe(first.uploadUrl);
      expect(
        (await reservation(first.storageKey)).expiresAt.getTime(),
      ).toBeGreaterThan(nearExpiry.getTime());
      await upload(renewed.uploadUrl);
      expect(
        await attachPhoto(db, author, {
          placeId,
          storageKey: renewed.storageKey,
        }),
      ).toEqual({ status: "pending" });
      expect(await audits(placeId, "place_photo.upload_reserved")).toHaveLength(
        1,
      );
    }, 15_000);

    test("normalization strips EXIF and reorients pixels; replayed PUT cannot overwrite canonical bytes", async () => {
      const author = await member();
      const placeId = await place(author);
      const reserved = await reserve(author, input(placeId));
      await upload(reserved.uploadUrl);
      const attachment = { placeId, storageKey: reserved.storageKey };
      const results = await Promise.all([
        attachPhoto(db, author, attachment),
        attachPhoto(db, author, attachment),
      ]);
      expect(results).toEqual([{ status: "pending" }, { status: "pending" }]);
      const row = await reservation(reserved.storageKey);
      if (!row.finalKey) throw new Error("Missing canonical photo key");
      expect(row.finalKey).not.toBe(reserved.storageKey);
      const accepted = await getObjectBytes(row.finalKey);
      const metadata = await sharp(accepted).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(12);
      expect(metadata.height).toBe(24);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      expect((await statObject(row.finalKey))?.contentType).toBe("image/webp");
      await upload(reserved.uploadUrl, new Uint8Array(jpeg.length).fill(42));
      expect(await attachPhoto(db, author, attachment)).toEqual({
        status: "pending",
      });
      expect(await getObjectBytes(row.finalKey)).toEqual(accepted);
      expect(await audits(placeId, "place_photo.added")).toHaveLength(1);
      expect(
        await db
          .select()
          .from(placePhotos)
          .where(eq(placePhotos.placeId, placeId)),
      ).toHaveLength(1);
    }, 20_000);

    test("completed retries survive reservation expiry and temporary-object cleanup", async () => {
      const author = await member();
      const placeId = await place(author);
      const command = input(placeId);
      const reserved = await reserve(author, command);
      await upload(reserved.uploadUrl);
      const attachment = { placeId, storageKey: reserved.storageKey };
      await attachPhoto(db, author, attachment);
      const completed = await reservation(reserved.storageKey);
      if (!completed.finalKey) throw new Error("Missing finalized reservation");
      const accepted = await getObjectBytes(completed.finalKey);
      await db
        .update(photoUploads)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(photoUploads.storageKey, reserved.storageKey));
      expect(await attachPhoto(db, author, attachment)).toEqual({
        status: "pending",
      });
      expect(await requestPhotoUpload(db, author, command)).toEqual({
        status: "pending",
        storageKey: reserved.storageKey,
        uploadUrl: null,
      });
      await cleanupPhotoUploads(db);
      expect(await statObject(reserved.storageKey)).toBeNull();
      expect(
        (await reservation(reserved.storageKey)).temporaryDeletedAt,
      ).toBeInstanceOf(Date);
      expect(await getObjectBytes(completed.finalKey)).toEqual(accepted);
      expect(await requestPhotoUpload(db, author, command)).toEqual({
        status: "pending",
        storageKey: reserved.storageKey,
        uploadUrl: null,
      });
      expect(await attachPhoto(db, author, attachment)).toEqual({
        status: "pending",
      });
      const expirationAudits = await audits(
        placeId,
        "place_photo.upload_expired",
      );
      expect(expirationAudits).toHaveLength(1);
      await cleanupPhotoUploads(db);
      expect(await audits(placeId, "place_photo.upload_expired")).toHaveLength(
        1,
      );
      await expect(
        requestPhotoUpload(db, author, {
          ...command,
          sizeBytes: command.sizeBytes + 1,
        }),
      ).rejects.toMatchObject({ reason: "conflict" });
      expect(await audits(placeId, "place_photo.added")).toHaveLength(1);
    }, 20_000);

    test("only staff with municipal authority directly publish a new photo", async () => {
      const author = await member();
      const staff = await member("moderator");
      const placeId = await place(author, "published");
      const command = input(placeId);
      const reserved = await reserve(staff, command);
      await upload(reserved.uploadUrl);
      expect(
        await attachPhoto(db, staff, {
          placeId,
          storageKey: reserved.storageKey,
        }),
      ).toEqual({ status: "published" });
      expect(
        await placePhotoUrls(db, { kind: "anonymous" }, placeId),
      ).toHaveLength(1);
      expect(await requestPhotoUpload(db, staff, command)).toEqual({
        status: "published",
        storageKey: reserved.storageKey,
        uploadUrl: null,
      });
    });

    test("malformed bytes, missing bytes, and another owner's key never create attachments", async () => {
      const author = await member();
      const stranger = await member();
      const placeId = await place(author, "published");
      const malformed = new TextEncoder().encode("This is not a JPEG image.");
      const reserved = await reserve(author, input(placeId, malformed));
      const attachment = { placeId, storageKey: reserved.storageKey };
      await expect(attachPhoto(db, author, attachment)).rejects.toMatchObject({
        reason: "invalid",
      });
      await upload(reserved.uploadUrl, malformed);
      await expect(attachPhoto(db, stranger, attachment)).rejects.toMatchObject(
        { reason: "invalid" },
      );
      await expect(attachPhoto(db, author, attachment)).rejects.toMatchObject({
        reason: "unsupported_type",
      });
      expect((await reservation(reserved.storageKey)).finalKey).toBeNull();
      expect(
        await db
          .select()
          .from(placePhotos)
          .where(eq(placePhotos.placeId, placeId)),
      ).toHaveLength(0);
      expect(await audits(placeId, "place_photo.added")).toHaveLength(0);
    });

    test("declared size and content type are verified against the stored object before decoding", async () => {
      const author = await member();
      const placeId = await place(author);
      const reserved = await reserve(author, input(placeId));
      const attachment = { placeId, storageKey: reserved.storageKey };
      // Write through the real adapter to exercise server-side checks even when
      // the local S3 implementation enforces the presigned request's headers.
      await putObject(
        reserved.storageKey,
        jpeg.subarray(0, jpeg.length - 1),
        "image/jpeg",
      );
      await expect(attachPhoto(db, author, attachment)).rejects.toMatchObject({
        reason: "invalid",
      });
      await putObject(reserved.storageKey, jpeg, "image/png");
      await expect(attachPhoto(db, author, attachment)).rejects.toMatchObject({
        reason: "invalid",
      });
      expect((await reservation(reserved.storageKey)).finalKey).toBeNull();
      expect(await audits(placeId, "place_photo.added")).toHaveLength(0);
      await upload(reserved.uploadUrl);
      expect(await attachPhoto(db, author, attachment)).toEqual({
        status: "pending",
      });
      expect(await audits(placeId, "place_photo.added")).toHaveLength(1);
    });

    test("a failed finalization deletes its canonical object and can be retried", async () => {
      const author = await member();
      const placeId = await place(author);
      const reserved = await reserve(author, input(placeId));
      await upload(reserved.uploadUrl);
      const attachment = { placeId, storageKey: reserved.storageKey };
      const digest = createHash("sha256")
        .update(reserved.storageKey)
        .digest("hex");
      const finalKey = `published-photos/${placeId}/${digest}.webp`;
      objectKeys.add(finalKey);

      // The upload and the image work succeed; the database write does not.
      // That is the crash boundary the canonical object has to survive: an
      // object nobody references is an orphan, not a photograph.
      const name = `media_attach_${crypto.randomUUID().replaceAll("-", "")}`;
      const client = await pool.connect();
      try {
        await client.query(
          `CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.place_id = '${placeId}' THEN RAISE EXCEPTION 'synthetic attach failure'; END IF; RETURN NEW; END $$`,
        );
        await client.query(
          `CREATE TRIGGER "${name}" BEFORE INSERT ON place_photos FOR EACH ROW EXECUTE FUNCTION "${name}"()`,
        );
        await expect(attachPhoto(db, author, attachment)).rejects.toBeDefined();
        expect(await statObject(finalKey)).toBeNull();
        expect((await reservation(reserved.storageKey)).finalKey).toBeNull();
        expect(
          await db
            .select()
            .from(placePhotos)
            .where(eq(placePhotos.placeId, placeId)),
        ).toHaveLength(0);
      } finally {
        try {
          await client.query(
            `DROP TRIGGER IF EXISTS "${name}" ON place_photos`,
          );
          await client.query(`DROP FUNCTION IF EXISTS "${name}"()`);
        } finally {
          client.release();
        }
      }

      // The temporary upload was never consumed, so the same attachment works.
      expect(await attachPhoto(db, author, attachment)).toEqual({
        status: "pending",
      });
      expect((await reservation(reserved.storageKey)).finalKey).toBe(finalKey);
      expect(await audits(placeId, "place_photo.added")).toHaveLength(1);
    });

    test("failed cleanup retains its reservation and safely retries an already deleted object", async () => {
      const author = await member();
      const placeId = await place(author);
      const command = input(placeId);
      const reserved = await reserve(author, command);
      await upload(reserved.uploadUrl);
      const digest = createHash("sha256")
        .update(reserved.storageKey)
        .digest("hex");
      const orphanKey = `published-photos/${placeId}/${digest}.webp`;
      objectKeys.add(orphanKey);
      await putObject(orphanKey, new Uint8Array([1, 2, 3]), "image/webp");
      // Simulate the real crash boundary: S3 deletion succeeds but the following
      // transactional audit fails. A narrowly scoped PostgreSQL trigger, not a mock,
      // forces rollback while leaving the external object deletion committed.
      const name = `media_cleanup_${crypto.randomUUID().replaceAll("-", "")}`;
      const client = await pool.connect();
      try {
        await client.query(
          `CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'place_photo.upload_expired' AND NEW.subject_id = '${placeId}' THEN RAISE EXCEPTION 'synthetic media cleanup failure'; END IF; RETURN NEW; END $$`,
        );
        await client.query(
          `CREATE TRIGGER "${name}" BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION "${name}"()`,
        );
        await db
          .update(photoUploads)
          .set({ expiresAt: new Date(Date.now() - 1000) })
          .where(eq(photoUploads.storageKey, reserved.storageKey));
        await cleanupPhotoUploads(db);
        expect(await statObject(reserved.storageKey)).toBeNull();
        expect((await reservation(reserved.storageKey)).finalKey).toBeNull();
        expect(
          (await reservation(reserved.storageKey)).temporaryDeletedAt,
        ).toBeNull();
        expect(
          await audits(placeId, "place_photo.upload_expired"),
        ).toHaveLength(0);
      } finally {
        try {
          await client.query(
            `DROP TRIGGER IF EXISTS "${name}" ON audit_events`,
          );
          await client.query(`DROP FUNCTION IF EXISTS "${name}"()`);
        } finally {
          client.release();
        }
      }
      await cleanupPhotoUploads(db);
      expect(
        (await reservation(reserved.storageKey)).temporaryDeletedAt,
      ).toBeInstanceOf(Date);
      expect(await statObject(reserved.storageKey)).toBeNull();
      expect(await audits(placeId, "place_photo.upload_expired")).toHaveLength(
        1,
      );
      await cleanupPhotoUploads(db);
      expect(await audits(placeId, "place_photo.upload_expired")).toHaveLength(
        1,
      );
      expect(await statObject(orphanKey)).toBeNull();
      await expect(
        attachPhoto(db, author, { placeId, storageKey: reserved.storageKey }),
      ).rejects.toMatchObject({ reason: "invalid" });
      const renewed = await reserve(author, command);
      expect(renewed.storageKey).toBe(reserved.storageKey);
      expect(
        (await reservation(reserved.storageKey)).temporaryDeletedAt,
      ).toBeNull();
      await upload(renewed.uploadUrl);
      expect(
        await attachPhoto(db, author, {
          placeId,
          storageKey: renewed.storageKey,
        }),
      ).toEqual({ status: "pending" });
      expect(await audits(placeId, "place_photo.upload_reserved")).toHaveLength(
        1,
      );
    }, 20_000);
  },
);
