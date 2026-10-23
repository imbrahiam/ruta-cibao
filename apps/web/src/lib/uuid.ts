/**
 * A UUID, available in every context the app can run in.
 *
 * `crypto.randomUUID` needs a secure context, which a Tailscale IP over HTTP
 * is not, and on older Safari it is flatly absent even over HTTPS. A bare
 * insecure origin still has to render the app, so every `useState` initializer
 * that generates an idempotency key goes through here.
 */
export function uuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 shape, built one lane at a time so the `noUncheckedIndexedAccess`
  // narrowing stays out of the way. Both branches below land on a Uint8Array.
  const bytes: Uint8Array =
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
      ? crypto.getRandomValues(new Uint8Array(16))
      : fromRandom();
  // Version 4 (random) and variant 10.
  bytes[6] = ((bytes.at(6) ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes.at(8) ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fromRandom(): Uint8Array {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}
