/**
 * Upload keys that prove who they were issued to, and the format check for
 * what lands under them. Pure, so it is testable without storage or a
 * database; `photos.ts` passes the server secret in.
 *
 * A key looks like `places/<place>/<file id>.<signature>.<ext>`. The signature
 * is an HMAC over the place, the person and the file id, keyed with a secret
 * that never leaves the server — so a key handed to one person cannot be
 * attached by another, and none can be made up.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** 22 base64url characters: 132 bits, plenty for a value with no oracle. */
const SIGNATURE_LENGTH = 22;

function signature(
  secret: string,
  placeId: string,
  userId: string,
  fileId: string,
  extension: string,
): string {
  return createHmac("sha256", secret)
    .update(`place-photo:${placeId}:${userId}:${fileId}:${extension}`)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);
}

export function issuePhotoKey(
  secret: string,
  placeId: string,
  userId: string,
  extension: string,
  fileId: string = crypto.randomUUID(),
): string {
  const signed = signature(secret, placeId, userId, fileId, extension);
  return `places/${placeId}/${fileId}.${signed}.${extension}`;
}

const KEY_PATTERN =
  /^places\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.([A-Za-z0-9_-]{22})\.(jpg|png|webp)$/;

/** Whether this person was issued this key, for this place. */
export function keyIssuedTo(
  secret: string,
  storageKey: string,
  placeId: string,
  userId: string,
): boolean {
  const match = KEY_PATTERN.exec(storageKey);
  if (!match) return false;
  const [, keyPlaceId, fileId, given, extension] = match;
  if (keyPlaceId !== placeId || !fileId || !given || !extension) return false;

  const expected = Buffer.from(
    signature(secret, placeId, userId, fileId, extension),
  );
  const actual = Buffer.from(given);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Whether the first bytes of a file are those of the format its key names. */
export function looksLike(extension: string, head: Uint8Array): boolean {
  const at = (offset: number, ...bytes: number[]) =>
    bytes.every((byte, index) => head[offset + index] === byte);

  switch (extension) {
    case "jpg":
      return at(0, 0xff, 0xd8, 0xff);
    case "png":
      return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "webp":
      // "RIFF", four bytes of length, "WEBP".
      return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
    default:
      return false;
  }
}
