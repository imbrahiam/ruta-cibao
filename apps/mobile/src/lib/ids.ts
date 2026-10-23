/**
 * A v4 UUID for idempotent requests. The native app keeps the same id across
 * retries of one action, so the server applies it once.
 */
export function requestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** API image paths can be relative to the server. */
export function mediaUrl(path: string, origin: string): string {
  return /^https?:\/\//.test(path)
    ? path
    : `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}
