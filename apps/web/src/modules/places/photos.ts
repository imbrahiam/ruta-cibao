import { createHash } from "node:crypto";
import { MAX_PHOTO_BYTES } from "@ruta/contracts";
import { and, asc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
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
import { hasStaffAuthority } from "@/modules/access/permissions";
import type { MemberViewer, Viewer } from "@/modules/access/viewer";
import { scheduleOfflineSnapshotRebuild } from "@/modules/offline/snapshot";
import { notBlockedAuthor } from "@/modules/safety/blocks";
import { issuePhotoKey, keyIssuedTo } from "./photo-key";

/**
 * Photographs of a place, taken by whoever was standing in front of it.
 *
 * The client uploads to a signed temporary key. Attachment fully decodes and
 * normalizes the image, strips metadata, and writes a separate canonical key.
 * Reservations bound upload volume and allow abandoned objects to be removed.
 * Replaying the upload URL cannot change an accepted photograph.
 */
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** How many published photos a place shows, and how many it accepts. */
export const MAX_PHOTOS_PER_PLACE = 8;

export class PhotoError extends Error {
  constructor(
    readonly reason:
      | "not_found"
      | "unsupported_type"
      | "too_many"
      | "invalid"
      | "conflict",
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

type PhotoUploadResult =
  | { status: "upload"; storageKey: string; uploadUrl: string }
  | { status: "pending" | "published"; storageKey: string; uploadUrl: null };

export async function requestPhotoUpload(
  db: Db,
  viewer: MemberViewer,
  input: {
    requestId: string;
    placeId: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<PhotoUploadResult> {
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        placeId: input.placeId,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      }),
    )
    .digest("hex");

  return db.transaction(async (tx): Promise<PhotoUploadResult> => {
    // Serialize every reservation for this owner, including different request
    // UUIDs, so concurrent requests cannot exceed the active-upload allowance.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`photo-upload:${viewer.userId}`}))`,
    );
    const [existing] = await tx
      .select()
      .from(photoUploads)
      .where(
        and(
          eq(photoUploads.userId, viewer.userId),
          eq(photoUploads.requestId, input.requestId),
        ),
      )
      .limit(1)
      .for("update");
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new PhotoError("conflict");
      if (
        !keyIssuedTo(
          env.BETTER_AUTH_SECRET,
          existing.storageKey,
          input.placeId,
          viewer.userId,
        )
      ) {
        throw new PhotoError("invalid");
      }
      // Recover an accepted upload even after expiry or a visibility change.
      // Never issue another PUT capability for a finalized reservation.
      if (existing.finalKey) {
        if (!existing.status) throw new PhotoError("invalid");
        return {
          status: existing.status,
          storageKey: existing.storageKey,
          uploadUrl: null,
        };
      }
    }
    if (!ALLOWED_PHOTO_TYPES.includes(input.contentType as never)) {
      throw new PhotoError("unsupported_type");
    }
    if (input.sizeBytes > MAX_PHOTO_BYTES || input.sizeBytes <= 0) {
      throw new PhotoError("invalid");
    }
    const [place] = await tx
      .select({ id: places.id })
      .from(places)
      .where(
        and(
          eq(places.id, input.placeId),
          or(
            eq(places.status, "published"),
            and(
              eq(places.status, "pending"),
              eq(places.createdByUserId, viewer.userId),
            ),
          ),
        ),
      )
      .limit(1)
      .for("update");
    if (!place) throw new PhotoError("not_found");
    if (!existing) {
      const allowance = await consumeRateLimit(
        viewer.userId,
        { scope: "photo-upload", limit: 12, windowMs: 3_600_000 },
        tx,
      );
      if (!allowance.allowed) throw new PhotoError("too_many");
    }
    const now = new Date();
    if (!existing || existing.expiresAt <= now) {
      const [active] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(photoUploads)
        .where(
          and(
            eq(photoUploads.userId, viewer.userId),
            isNull(photoUploads.finalKey),
            gt(photoUploads.expiresAt, now),
          ),
        );
      if ((active?.count ?? 0) >= 3) throw new PhotoError("too_many");
    }
    const storageKey =
      existing?.storageKey ??
      photoKey(input.placeId, viewer.userId, input.contentType);
    // Keep the persisted window stable on fresh retries. Renew before a new
    // five-minute upload capability could outlive its reservation.
    const renew =
      existing &&
      (existing.temporaryDeletedAt !== null ||
        existing.expiresAt.getTime() <= now.getTime() + 5 * 60_000);
    const expiresAt = new Date(now.getTime() + 24 * 3_600_000);
    if (!existing) {
      await tx.insert(photoUploads).values({
        storageKey,
        requestId: input.requestId,
        requestHash,
        userId: viewer.userId,
        placeId: place.id,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresAt,
      });
    } else if (renew) {
      await tx
        .update(photoUploads)
        .set({ expiresAt, temporaryDeletedAt: null })
        .where(eq(photoUploads.storageKey, storageKey));
    }
    if (!existing || renew) {
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: existing
            ? "place_photo.upload_renewed"
            : "place_photo.upload_reserved",
          subjectType: "place",
          subjectId: place.id,
        },
        tx,
      );
    }
    const uploadUrl = await createUploadUrl(
      storageKey,
      input.contentType,
      input.sizeBytes,
    );
    return { status: "upload", uploadUrl, storageKey };
  });
}

/**
 * Recording a photo that has finished uploading.
 *
 * Only staff with authority over the place's municipality publish directly.
 * Every other photograph waits for moderation, including an author's upload
 * to their own pending place. Contact verification is not publication authority.
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
    const [upload] = await tx
      .select()
      .from(photoUploads)
      .where(
        and(
          eq(photoUploads.storageKey, input.storageKey),
          eq(photoUploads.userId, viewer.userId),
          eq(photoUploads.placeId, input.placeId),
        ),
      )
      .limit(1)
      .for("update");
    if (!upload) throw new PhotoError("invalid");
    // Keep acknowledgement recovery independent of expiry and place visibility,
    // but only after the temporary key and reservation owner have been checked.
    if (upload.finalKey) {
      if (!upload.status) throw new PhotoError("invalid");
      return { status: upload.status };
    }
    const [place] = await tx
      .select({ id: places.id, municipalityId: places.municipalityId })
      .from(places)
      .where(
        and(
          eq(places.id, input.placeId),
          or(
            eq(places.status, "published"),
            and(
              eq(places.status, "pending"),
              eq(places.createdByUserId, viewer.userId),
            ),
          ),
        ),
      )
      .limit(1)
      .for("update");
    if (!place) throw new PhotoError("not_found");
    if (upload.expiresAt <= new Date()) throw new PhotoError("invalid");
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
    if (upload.expiresAt <= new Date()) throw new PhotoError("invalid");
    // New photographs wait for review; only staff with authority over this
    // municipality publish directly. A verified contact is not that authority.
    const status = hasStaffAuthority(viewer, place.municipalityId)
      ? "published"
      : "pending";
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
    if (status === "published") await scheduleOfflineSnapshotRebuild(tx);
    return { status };
  });
}

/** The published photos of a place, as URLs a client can render. */
export async function placePhotoUrls(
  db: Db,
  viewer: Viewer,
  placeId: string,
): Promise<string[]> {
  const rows = await db
    .select({ storageKey: placePhotos.storageKey })
    .from(placePhotos)
    .where(
      and(
        eq(placePhotos.placeId, placeId),
        eq(placePhotos.status, "published"),
        notBlockedAuthor(placePhotos.uploadedByUserId, viewer),
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

/** Expired temporary objects are removed; request bindings and receipts survive. */
export async function cleanupPhotoUploads(db: Db): Promise<number> {
  const expired = await db
    .select()
    .from(photoUploads)
    .where(
      and(
        lte(photoUploads.expiresAt, new Date()),
        isNull(photoUploads.temporaryDeletedAt),
      ),
    )
    .limit(50);
  let removed = 0;
  for (const upload of expired) {
    try {
      const cleaned = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(photoUploads)
          .where(eq(photoUploads.storageKey, upload.storageKey))
          .limit(1)
          .for("update");
        if (
          !current ||
          current.expiresAt > new Date() ||
          current.temporaryDeletedAt
        ) {
          return false;
        }
        await deleteObject(current.storageKey);
        if (!current.finalKey) {
          // A failed finalization may have written its canonical object before
          // its database transaction rolled back. It is not an accepted photo.
          await deleteObject(
            canonicalPhotoKey(current.placeId, current.storageKey),
          );
        }
        // Retain every owner/request binding. An unfinished reservation can
        // renew at its original key; a completed one remains an immutable receipt.
        await tx
          .update(photoUploads)
          .set({ temporaryDeletedAt: new Date() })
          .where(eq(photoUploads.storageKey, current.storageKey));
        await recordAudit(
          {
            action: "place_photo.upload_expired",
            subjectType: "place",
            subjectId: upload.placeId,
          },
          tx,
        );
        return true;
      });
      if (cleaned) removed++;
    } catch {
      console.error("temporary photo cleanup failed; will retry");
    }
  }
  return removed;
}
