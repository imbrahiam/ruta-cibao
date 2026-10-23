/**
 * The photos behind a verification request, at rest.
 *
 * A photo of a cédula is the cédula, plus a face: it is the most sensitive
 * thing this platform holds, so it never sits anywhere in the clear. The bytes
 * arrive at this server (not straight at storage, unlike a place photo), are
 * checked, and are encrypted with the same key as the cédula number before
 * they are written. Storage only ever sees ciphertext, under keys only the
 * `identity_reviews` row knows.
 */
import { decryptSensitiveBytes, encryptSensitiveBytes } from "@/lib/crypto";
import { normalizePhoto } from "@/lib/image";
import { deleteObject, getObjectBytes, putObject } from "@/lib/storage";
import { looksLike } from "@/modules/places/photo-key";
import {
  type IdentityDocumentKind,
  IdentityError,
  MAX_DOCUMENT_BYTES,
} from "./contracts";

export type ImageFormat = "jpg" | "png" | "webp";

const CONTENT_TYPES: Record<ImageFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** What the bytes are, whatever the file claimed to be. */
export function detectImage(bytes: Uint8Array): ImageFormat | null {
  for (const format of ["jpg", "png", "webp"] as const) {
    if (looksLike(format, bytes)) return format;
  }
  return null;
}

export function contentTypeOf(bytes: Uint8Array): string {
  const format = detectImage(bytes);
  return format ? CONTENT_TYPES[format] : "application/octet-stream";
}

/** Throws unless the bytes are a plausible photo of a document. */
export function assertDocument(
  kind: IdentityDocumentKind,
  bytes: Uint8Array | null | undefined,
): asserts bytes is Uint8Array {
  if (!bytes || bytes.byteLength === 0) {
    throw new IdentityError("missing_file", kind);
  }
  if (bytes.byteLength > MAX_DOCUMENT_BYTES || detectImage(bytes) === null) {
    throw new IdentityError("invalid_file", kind);
  }
}

export function documentKey(
  userId: string,
  reviewId: string,
  kind: IdentityDocumentKind,
): string {
  return `identity/${userId}/${reviewId}/${kind}.bin`;
}

export async function storeDocument(
  key: string,
  bytes: Uint8Array,
): Promise<void> {
  let normalized: Uint8Array;
  try {
    normalized = await normalizePhoto(bytes);
  } catch {
    throw new IdentityError("invalid_file");
  }
  await putObject(
    key,
    encryptSensitiveBytes(normalized),
    "application/octet-stream",
  );
}

export async function readDocument(key: string): Promise<Uint8Array> {
  return decryptSensitiveBytes(await getObjectBytes(key));
}

/** S3 deletion is idempotent. A failed deletion must remain retryable. */
export async function purgeDocuments(
  keys: (string | null | undefined)[],
): Promise<void> {
  await Promise.all(
    keys
      .filter((key): key is string => Boolean(key))
      .map((key) => deleteObject(key)),
  );
}
