import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { placePhotos, places } from "@/db/schema";
import { recordAudit } from "@/lib/audit";
import { createUploadUrl, imageUrl } from "@/lib/storage";
import type { MemberViewer } from "@/modules/access/viewer";

/**
 * Photographs of a place, taken by whoever was standing in front of it.
 *
 * The file never passes through this server. The browser is handed a URL it may
 * PUT one object to and nothing else, uploads straight to storage, and then
 * tells the app where it landed — which is what keeps a phone camera's output
 * out of a Node process's memory on a small VPS.
 *
 * That trust is bounded on purpose: the key is generated here, so a client
 * cannot choose where it writes; the content type is checked against a short
 * allowlist; and a row only exists once the app has been told about it, so an
 * orphaned object is invisible rather than dangerous.
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
function photoKey(placeId: string, contentType: string): string {
  const extension = EXTENSIONS[contentType] ?? "bin";
  return `places/${placeId}/${crypto.randomUUID()}.${extension}`;
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

  const [place] = await db
    .select({ id: places.id })
    .from(places)
    .where(and(eq(places.id, input.placeId), eq(places.status, "published")))
    .limit(1);

  if (!place) throw new PhotoError("not_found");

  const pending = await db
    .select({ id: placePhotos.id })
    .from(placePhotos)
    .where(
      and(
        eq(placePhotos.placeId, place.id),
        eq(placePhotos.uploadedByUserId, viewer.userId),
        eq(placePhotos.status, "pending"),
      ),
    );

  // One in flight at a time per person: a presigned URL that is never used
  // costs nothing, but a client looping on this one would fill the bucket.
  if (pending.length >= 3) throw new PhotoError("too_many");

  const storageKey = photoKey(place.id, input.contentType);
  const uploadUrl = await createUploadUrl(storageKey, input.contentType);

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
  // The key has to be one this server issued for this place; anything else is
  // a client naming an object it does not own.
  if (!input.storageKey.startsWith(`places/${input.placeId}/`)) {
    throw new PhotoError("invalid");
  }

  const [place] = await db
    .select({ id: places.id, municipalityId: places.municipalityId })
    .from(places)
    .where(and(eq(places.id, input.placeId), eq(places.status, "published")))
    .limit(1);

  if (!place) throw new PhotoError("not_found");

  const published = await db
    .select({ id: placePhotos.id })
    .from(placePhotos)
    .where(
      and(
        eq(placePhotos.placeId, place.id),
        eq(placePhotos.status, "published"),
      ),
    );

  if (published.length >= MAX_PHOTOS_PER_PLACE) {
    throw new PhotoError("too_many");
  }

  const status = viewer.kind === "citizen" ? "published" : "pending";

  await db
    .insert(placePhotos)
    .values({
      placeId: place.id,
      uploadedByUserId: viewer.userId,
      storageKey: input.storageKey,
      status,
    })
    .onConflictDoNothing();

  await recordAudit({
    actorUserId: viewer.userId,
    action: "place_photo.added",
    subjectType: "place",
    subjectId: place.id,
    municipalityId: place.municipalityId,
    metadata: { status },
  });

  return { status };
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

/**
 * One photo to stand for the place — the first published one — sized for a
 * thumbnail. The assistant cards use it; a place with no photos gets null
 * rather than a filler, so the card falls back to its category icon.
 */
export async function placeCoverUrl(
  db: Db,
  placeId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ storageKey: placePhotos.storageKey })
    .from(placePhotos)
    .where(
      and(
        eq(placePhotos.placeId, placeId),
        eq(placePhotos.status, "published"),
      ),
    )
    .orderBy(asc(placePhotos.createdAt))
    .limit(1);

  if (!row) return null;
  return imageUrl(row.storageKey, { width: 800, height: 800, resize: "fill" });
}
