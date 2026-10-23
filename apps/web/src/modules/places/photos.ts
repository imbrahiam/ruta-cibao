import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { photoUploads, placePhotos, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { normalizePhoto } from "@/lib/image";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  createUploadUrl,
  deleteObject,
  getObjectBytes,
  imageUrl,
  putObject,
  statObject,
} from "@/lib/storage";
import type { MemberViewer } from "@/modules/access/viewer";
import { issuePhotoKey, keyIssuedTo } from "./photo-key";

/**
 * Photographs of a place, taken by whoever was standing in front of it.
 *
 * The browser uploads to a signed temporary key. Attachment fully decodes and
 * normalizes the image, strips metadata, and writes a separate canonical key.
 * Reservations bound upload volume and allow abandoned objects to be removed.
 * Replaying the upload URL cannot change an accepted photograph.
 */
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Roughly a full-resolution phone photo; anything larger is a mistake. */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

/** How many published photos a place shows, and how many it accepts. */
export const MAX_PHOTOS_PER_PLACE = 8;

export class PhotoError extends Error {
  constructor(
    readonly reason: "not_found" | "unsupported_type" | "too_many" | "invalid",
  ) {
    super(reason);
    this.name = "PhotoError";
  }
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Where a photo of this place is allowed to be written.
 *
 * Keyed by place and a fresh id rather than by anything the client sends: a
 * presigned URL is a capability, and one whose path a client could influence is
 * a capability to overwrite somebody else's photo.
 */
function photoKey(
  placeId: string,
  userId: string,
  contentType: string,
): string {
  return issuePhotoKey(
    env.BETTER_AUTH_SECRET,
    placeId,
    userId,
    EXTENSIONS[contentType] ?? "bin",
  );
}

export async function requestPhotoUpload(
  db: Db,
  viewer: MemberViewer,
  input: { placeId: string; contentType: string; sizeBytes: number },
): Promise<{ uploadUrl: string; storageKey: string }> {
  if (!ALLOWED_PHOTO_TYPES.includes(input.contentType as never)) {
    throw new PhotoError("unsupported_type");
  }
  if (input.sizeBytes > MAX_PHOTO_BYTES || input.sizeBytes <= 0) {
    throw new PhotoError("invalid");
  }

  const storageKey = photoKey(input.placeId, viewer.userId, input.contentType);
  await db.transaction(async (tx) => {
    const [place] = await tx
      .select({ id: places.id })
      .from(places)
      .where(and(eq(places.id, input.placeId), eq(places.status, "published")))
      .limit(1)
      .for("update");
    if (!place) throw new PhotoError("not_found");
    const allowance = await consumeRateLimit(
      viewer.userId,
      { scope: "photo-upload", limit: 12, windowMs: 3_600_000 },
      tx,
    );
    if (!allowance.allowed) throw new PhotoError("too_many");
    const [active] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(photoUploads)
      .where(
        and(
          eq(photoUploads.userId, viewer.userId),
          isNull(photoUploads.finalKey),
          gt(photoUploads.expiresAt, new Date()),
        ),
      );
    if ((active?.count ?? 0) >= 3) throw new PhotoError("too_many");
    await tx.insert(photoUploads).values({
      storageKey,
      userId: viewer.userId,
      placeId: place.id,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      expiresAt: new Date(Date.now() + 24 * 3_600_000),
    });
    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: "place_photo.upload_reserved",
        subjectType: "place",
        subjectId: place.id,
      },
      tx,
    );
  });
  const uploadUrl = await createUploadUrl(
    storageKey,
    input.contentType,
    input.sizeBytes,
  );
  return { uploadUrl, storageKey };
}

/**
 * Recording a photo that has finished uploading.
 *
 * A verified resident's photo is published on the spot; everybody else's waits
 * for a moderator. The asymmetry is the return on verifying a cédula, and it
 * keeps the queue down to the submissions that genuinely need a person.
 */
export async function attachPhoto(
  db: Db,
  viewer: MemberViewer,
  input: { placeId: string; storageKey: string },
): Promise<{ status: "published" | "pending" }> {
  // The key has to be one this server issued for this place *to this
  // person*; anything else is a client naming an object it does not own.
  if (
    !keyIssuedTo(
      env.BETTER_AUTH_SECRET,
      input.storageKey,
      input.placeId,
      viewer.userId,
    )
  ) {
    throw new PhotoError("invalid");
  }

  return db.transaction(async (tx) => {
    const [place] = await tx
      .select({ id: places.id, municipalityId: places.municipalityId })
      .from(places)
      .where(and(eq(places.id, input.placeId), eq(places.status, "published")))
      .limit(1)
      .for("update");
    if (!place) throw new PhotoError("not_found");
    const [upload] = await tx
      .select()
      .from(photoUploads)
      .where(
        and(
          eq(photoUploads.storageKey, input.storageKey),
          eq(photoUploads.userId, viewer.userId),
          eq(photoUploads.placeId, place.id),
        ),
      )
      .limit(1)
      .for("update");
    if (!upload || upload.expiresAt <= new Date())
      throw new PhotoError("invalid");
    if (upload.finalKey && upload.status) return { status: upload.status };
    const [published] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(placePhotos)
      .where(
        and(
          eq(placePhotos.placeId, place.id),
          eq(placePhotos.status, "published"),
        ),
      );
    if ((published?.count ?? 0) >= MAX_PHOTOS_PER_PLACE)
      throw new PhotoError("too_many");
    const stat = await statObject(input.storageKey);
    if (
      !stat ||
      stat.size !== upload.sizeBytes ||
      stat.size > MAX_PHOTO_BYTES ||
      stat.contentType !== upload.contentType
    )
      throw new PhotoError("invalid");
    let normalized: Uint8Array;
    try {
      normalized = await normalizePhoto(await getObjectBytes(input.storageKey));
    } catch {
      throw new PhotoError("unsupported_type");
    }
    // Publish a server-written object. Reusing the presigned PUT can only
    // change the temporary upload, never an already accepted photograph.
    const finalKey = canonicalPhotoKey(place.id, input.storageKey);
    await putObject(finalKey, normalized, "image/webp");
    const status = viewer.kind === "citizen" ? "published" : "pending";
    await tx.insert(placePhotos).values({
      placeId: place.id,
      uploadedByUserId: viewer.userId,
      storageKey: finalKey,
      status,
    });
    await tx
      .update(photoUploads)
      .set({ finalKey, status })
      .where(eq(photoUploads.storageKey, input.storageKey));
    await recordAudit(
      {
        actorUserId: viewer.userId,
        action: "place_photo.added",
        subjectType: "place",
        subjectId: place.id,
        municipalityId: place.municipalityId,
        metadata: { status },
      },
      tx,
    );
    return { status };
  });
}

/** The published photos of a place, as URLs the browser can render. */
export async function placePhotoUrls(
  db: Db,
  placeId: string,
): Promise<string[]> {
  const rows = await db
    .select({ storageKey: placePhotos.storageKey })
    .from(placePhotos)
    .where(
      and(
        eq(placePhotos.placeId, placeId),
        eq(placePhotos.status, "published"),
      ),
    )
    .orderBy(asc(placePhotos.createdAt))
    .limit(MAX_PHOTOS_PER_PLACE);

  return Promise.all(
    rows.map((row) =>
      imageUrl(row.storageKey, { width: 1200, height: 800, resize: "fill" }),
    ),
  );
}

function canonicalPhotoKey(placeId: string, storageKey: string): string {
  const digest = createHash("sha256").update(storageKey).digest("hex");
  return `published-photos/${placeId}/${digest}.webp`;
}

/** Temporary uploads expire even when the browser never attaches them. */
export async function cleanupPhotoUploads(db: Db): Promise<number> {
  const expired = await db
    .select()
    .from(photoUploads)
    .where(lte(photoUploads.expiresAt, new Date()))
    .limit(50);
  let removed = 0;
  for (const upload of expired) {
    try {
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(photoUploads)
          .where(eq(photoUploads.storageKey, upload.storageKey))
          .limit(1)
          .for("update");
        if (!current || current.expiresAt > new Date()) return;
        await deleteObject(current.storageKey);
        if (!current.finalKey)
          await deleteObject(
            canonicalPhotoKey(current.placeId, current.storageKey),
          );
        await tx
          .delete(photoUploads)
          .where(eq(photoUploads.storageKey, upload.storageKey));
        await recordAudit(
          {
            action: "place_photo.upload_expired",
            subjectType: "place",
            subjectId: upload.placeId,
          },
          tx,
        );
      });
      removed++;
    } catch {
      console.error("temporary photo cleanup failed; will retry");
    }
  }
  return removed;
}
