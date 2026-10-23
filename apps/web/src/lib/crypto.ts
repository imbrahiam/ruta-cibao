/**
 * Encryption and one-way lookups for data at rest.
 *
 * Ported, with the key read lazily so importing this
 * module costs nothing at build time (see the note in `@/lib/env`).
 *
 * Two shapes, used for different jobs:
 *   - `encryptSensitive` / `decryptSensitive` protect a value nobody should be
 *     able to read from a database dump — a cédula, a reporter's phone number.
 *     Ciphertext is different every time, so it cannot be searched.
 *   - `hashLookup` makes an encrypted value findable anyway. It is a keyed HMAC,
 *     so the same input always yields the same output and can be indexed, but
 *     nobody without the key can build a rainbow table for the 11-digit cédula
 *     space. Store both: the ciphertext to read back, the blind index to query.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { env } from "@/lib/env";

const BINARY_VERSION = 1;

let key: Buffer | undefined;

function encryptionKey(): Buffer {
  key ??= Buffer.from(env.APP_ENCRYPTION_KEY, "hex");
  return key;
}

export function encryptSensitive(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSensitive(value: string): string {
  const [version, ivValue, tagValue, encryptedValue] = value.split(":");

  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported encrypted value");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function encryptSensitiveBytes(value: Uint8Array): Uint8Array {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);

  return new Uint8Array(
    Buffer.concat([
      Buffer.from([BINARY_VERSION]),
      iv,
      cipher.getAuthTag(),
      encrypted,
    ]),
  );
}

export function decryptSensitiveBytes(value: Uint8Array): Uint8Array {
  if (value.byteLength < 30 || value[0] !== BINARY_VERSION) {
    throw new Error("Unsupported encrypted binary value");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    value.slice(1, 13),
  );
  decipher.setAuthTag(Buffer.from(value.slice(13, 29)));

  return new Uint8Array(
    Buffer.concat([decipher.update(value.slice(29)), decipher.final()]),
  );
}

/**
 * Deterministic, keyed digest of a value, for indexing something encrypted.
 * The namespace keeps digests from one column from matching another's.
 */
export function hashLookup(namespace: string, value: string): string {
  return createHmac("sha256", encryptionKey())
    .update(`${namespace}\0${value}`)
    .digest("base64url");
}

export function createOpaqueToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string): string {
  return hashLookup("token", value);
}

export function hashContent(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
