import { createHash } from "node:crypto";
import { MAX_PHOTO_BYTES } from "@ruta/contracts";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import sharp from "sharp";
import type { Db } from "@/db";
import {
  consultationPhotos,
  consultationPhotoUploads,
  consultations,
} from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { normalizePhoto } from "@/lib/image";
import { errorDetails, logError } from "@/lib/log";
import { consumeRateLimit } from "@/lib/rate-limit";
import { publishRealtimeEvent } from "@/lib/realtime";
import {
  createUploadUrl,
  deleteObject,
  getObjectBytes,
  putObject,
  statObject,
} from "@/lib/storage";
import type { MemberViewer } from "@/modules/access/viewer";
import { PhotoError } from "@/modules/places/photos";
import { CONSULTATIONS_CHANNEL } from "./open-consultation";

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const ownedCase = (userId: string, consultationId: string) =>
  and(
    eq(consultations.id, consultationId),
    eq(consultations.openedByUserId, userId),
    sql`${consultations.publicationStatus} <> 'hidden'`,
  );
const ownedUpload = (
  userId: string,
  input: { consultationId: string; storageKey: string },
) =>
  and(
    eq(consultationPhotoUploads.storageKey, input.storageKey),
    eq(consultationPhotoUploads.consultationId, input.consultationId),
    eq(consultationPhotoUploads.userId, userId),
  );

/** The random key is a capability, bound in the database to its author and case. */
export async function requestConsultationPhotoUpload(
  db: Db,
  viewer: MemberViewer,
  input: {
    requestId: string;
    consultationId: string;
    contentType: string;
    sizeBytes: number;
  },
): Promise<{
  status: "upload" | "pending";
  storageKey: string;
  uploadUrl: string | null;
}> {
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        consultationId: input.consultationId,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      }),
    )
    .digest("hex");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`consultation-photo:${viewer.userId}`}))`,
    );
    const [existing] = await tx
      .select()
      .from(consultationPhotoUploads)
      .where(
        and(
          eq(consultationPhotoUploads.userId, viewer.userId),
          eq(consultationPhotoUploads.requestId, input.requestId),
        ),
      )
      .limit(1)
      .for("update");
    if (existing && existing.requestHash !== requestHash)
      throw new PhotoError("conflict");
    if (existing?.finalKey)
      return {
        status: "pending",
        storageKey: existing.storageKey,
        uploadUrl: null,
      };
    if (!extensions[input.contentType])
      throw new PhotoError("unsupported_type");
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_PHOTO_BYTES)
      throw new PhotoError("invalid");
    const [consultation] = await tx
      .select()
      .from(consultations)
      .where(ownedCase(viewer.userId, input.consultationId))
      .limit(1)
      .for("update");
    if (!consultation) throw new PhotoError("not_found");
    const [attached] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(consultationPhotos)
      .where(eq(consultationPhotos.consultationId, consultation.id));
    if ((attached?.count ?? 0) >= 4) throw new PhotoError("too_many");
    if (!existing) {
      const allowance = await consumeRateLimit(
        viewer.userId,
        { scope: "consultation-photo-upload", limit: 12, windowMs: 3_600_000 },
        tx,
      );
      if (!allowance.allowed) throw new PhotoError("too_many");
    }
    const now = new Date();
    if (!existing || existing.expiresAt <= now) {
      const [active] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(consultationPhotoUploads)
        .where(
          and(
            eq(consultationPhotoUploads.userId, viewer.userId),
            isNull(consultationPhotoUploads.finalKey),
            gt(consultationPhotoUploads.expiresAt, now),
          ),
        );
      if ((active?.count ?? 0) >= 4) throw new PhotoError("too_many");
    }
    const storageKey =
      existing?.storageKey ??
      `consultations/${consultation.id}/${crypto.randomUUID()}.${extensions[input.contentType]}`;
    const renew =
      existing &&
      (existing.temporaryDeletedAt !== null ||
        existing.expiresAt.getTime() <= now.getTime() + 5 * 60_000);
    const expiresAt = new Date(now.getTime() + 24 * 3_600_000);
    if (!existing)
      await tx.insert(consultationPhotoUploads).values({
        storageKey,
        userId: viewer.userId,
        consultationId: consultation.id,
        requestId: input.requestId,
        requestHash,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        expiresAt,
      });
    else if (renew)
      await tx
        .update(consultationPhotoUploads)
        .set({ expiresAt, temporaryDeletedAt: null })
        .where(eq(consultationPhotoUploads.storageKey, storageKey));
    if (!existing || renew)
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: existing
            ? "consultation_photo.upload_renewed"
            : "consultation_photo.upload_reserved",
          subjectType: "consultation",
          subjectId: consultation.id,
          municipalityId: consultation.municipalityId,
        },
        tx,
      );
    return {
      status: "upload",
      storageKey,
      uploadUrl: await createUploadUrl(
        storageKey,
        input.contentType,
        input.sizeBytes,
      ),
    };
  });
}

/** Images are reviewed with the case. A new image reopens publication review. */
export async function attachConsultationPhoto(
  db: Db,
  viewer: MemberViewer,
  input: {
    consultationId: string;
    storageKey: string;
  },
): Promise<{ status: "pending" }> {
  const owned = ownedUpload(viewer.userId, input);
  const [reservation] = await db
    .select()
    .from(consultationPhotoUploads)
    .where(owned)
    .limit(1);
  if (!reservation) throw new PhotoError("invalid");
  if (reservation.finalKey) return { status: "pending" };
  const [consultation] = await db
    .select({ id: consultations.id })
    .from(consultations)
    .where(ownedCase(viewer.userId, input.consultationId))
    .limit(1);
  if (!consultation) throw new PhotoError("not_found");
  if (reservation.expiresAt <= new Date()) throw new PhotoError("invalid");
  const stat = await statObject(input.storageKey);
  if (
    !stat ||
    stat.size !== reservation.sizeBytes ||
    stat.size > MAX_PHOTO_BYTES ||
    stat.contentType !== reservation.contentType
  )
    throw new PhotoError("invalid");
  const bytes = await getObjectBytes(input.storageKey);
  if (bytes.byteLength !== reservation.sizeBytes)
    throw new PhotoError("invalid");
  let normalized: Uint8Array;
  try {
    normalized = await normalizePhoto(bytes);
  } catch {
    throw new PhotoError("unsupported_type");
  }
  const dimensions = await sharp(normalized).metadata();
  const { width, height } = dimensions;
  if (!width || !height) throw new PhotoError("invalid");
  // Include the content digest: concurrent finalizations can never overwrite an
  // accepted image with different bytes, even while its PUT capability is live.
  const digest = createHash("sha256")
    .update(input.storageKey)
    .update(normalized)
    .digest("hex");
  const finalKey = `consultation-photos/${input.consultationId}/${digest}.webp`;
  await putObject(finalKey, normalized, "image/webp");
  try {
    return await db.transaction(async (tx) => {
      const [upload] = await tx
        .select()
        .from(consultationPhotoUploads)
        .where(owned)
        .limit(1)
        .for("update");
      if (!upload) throw new PhotoError("invalid");
      if (upload.finalKey) return { status: "pending" as const };
      const [current] = await tx
        .select()
        .from(consultations)
        .where(ownedCase(viewer.userId, input.consultationId))
        .limit(1)
        .for("update");
      if (!current) throw new PhotoError("not_found");
      if (upload.expiresAt <= new Date()) throw new PhotoError("invalid");
      const [count] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(consultationPhotos)
        .where(eq(consultationPhotos.consultationId, current.id));
      const position = count?.count ?? 0;
      if (position >= 4) throw new PhotoError("too_many");
      await tx.insert(consultationPhotos).values({
        consultationId: current.id,
        storageKey: finalKey,
        width,
        height,
        position,
        uploadedByUserId: viewer.userId,
      });
      await tx
        .update(consultationPhotoUploads)
        .set({ finalKey })
        .where(eq(consultationPhotoUploads.storageKey, input.storageKey));
      await tx
        .update(consultations)
        .set({ publicationStatus: "pending" })
        .where(eq(consultations.id, current.id));
      await recordAudit(
        {
          actorUserId: viewer.userId,
          action: "consultation_photo.added",
          subjectType: "consultation",
          subjectId: current.id,
          municipalityId: current.municipalityId,
          metadata: {
            status: "pending",
            publicationBefore: current.publicationStatus,
          },
        },
        tx,
      );
      if (current.publicationStatus === "published")
        await publishRealtimeEvent(
          {
            channel: CONSULTATIONS_CHANNEL,
            municipalityId: current.municipalityId,
            subjectType: "consultation",
            subjectId: current.id,
            action: "deleted",
          },
          tx,
        );
      return { status: "pending" as const };
    });
  } finally {
    // A losing concurrent attempt may have written a different normalized
    // object. Never delete the winner; cleanup failures must not lose its receipt.
    try {
      const [accepted] = await db
        .select({ id: consultationPhotos.id })
        .from(consultationPhotos)
        .where(eq(consultationPhotos.storageKey, finalKey))
        .limit(1);
      if (!accepted) await deleteObject(finalKey);
    } catch (error) {
      logError("consultations.photo_orphan_cleanup_failed", {
        finalKey,
        ...errorDetails(error),
      });
    }
  }
}

/** Temporary objects expire; durable request receipts remain for outbox retries. */
export async function cleanupConsultationPhotoUploads(db: Db): Promise<number> {
  const rows = await db
    .select()
    .from(consultationPhotoUploads)
    .where(
      and(
        lte(consultationPhotoUploads.expiresAt, new Date()),
        isNull(consultationPhotoUploads.temporaryDeletedAt),
      ),
    )
    .limit(50);
  let removed = 0;
  for (const row of rows) {
    try {
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(consultationPhotoUploads)
          .where(eq(consultationPhotoUploads.storageKey, row.storageKey))
          .limit(1)
          .for("update");
        if (
          !current ||
          current.expiresAt > new Date() ||
          current.temporaryDeletedAt
        )
          return;
        await deleteObject(current.storageKey);
        await tx
          .update(consultationPhotoUploads)
          .set({ temporaryDeletedAt: new Date() })
          .where(eq(consultationPhotoUploads.storageKey, current.storageKey));
        await recordAudit(
          {
            action: "consultation_photo.upload_expired",
            subjectType: "consultation",
            subjectId: current.consultationId,
          },
          tx,
        );
        removed++;
      });
    } catch (error) {
      logError("consultations.photo_cleanup_failed", {
        storageKey: row.storageKey,
        ...errorDetails(error),
      });
    }
  }
  return removed;
}
