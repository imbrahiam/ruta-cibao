import { describe, expect, test } from "bun:test";
import {
  issuePhotoKey,
  keyIssuedTo,
  looksLike,
} from "@/modules/places/photo-key";

const SECRET = "test-secret-that-is-at-least-32-characters";
const PLACE = "8a1f3c2e-5b6d-4e7f-9a0b-1c2d3e4f5a6b";
const ALICE = "user-alice";
const BOB = "user-bob";

describe("photo upload keys", () => {
  test("a key verifies for the person and place it was issued to", () => {
    const key = issuePhotoKey(SECRET, PLACE, ALICE, "jpg");
    expect(key.startsWith(`places/${PLACE}/`)).toBe(true);
    expect(keyIssuedTo(SECRET, key, PLACE, ALICE)).toBe(true);
  });

  test("someone else cannot attach a key they were not given", () => {
    const key = issuePhotoKey(SECRET, PLACE, ALICE, "jpg");
    expect(keyIssuedTo(SECRET, key, PLACE, BOB)).toBe(false);
  });

  test("a key does not move to another place", () => {
    const key = issuePhotoKey(SECRET, PLACE, ALICE, "png");
    const other = "1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9";
    expect(keyIssuedTo(SECRET, key, other, ALICE)).toBe(false);
    expect(keyIssuedTo(SECRET, key.replace(PLACE, other), other, ALICE)).toBe(
      false,
    );
  });

  test("tampering with the extension or signature fails", () => {
    const key = issuePhotoKey(SECRET, PLACE, ALICE, "jpg");
    expect(keyIssuedTo(SECRET, key.replace(/jpg$/, "png"), PLACE, ALICE)).toBe(
      false,
    );
    const forged = key.replace(
      /\.([A-Za-z0-9_-]{22})\./,
      ".AAAAAAAAAAAAAAAAAAAAAA.",
    );
    expect(keyIssuedTo(SECRET, forged, PLACE, ALICE)).toBe(false);
  });

  test("the old unsigned shape is refused", () => {
    expect(
      keyIssuedTo(
        SECRET,
        `places/${PLACE}/1b2c3d4e-5f60-4718-8293-a4b5c6d7e8f9.jpg`,
        PLACE,
        ALICE,
      ),
    ).toBe(false);
  });

  test("a different server secret does not verify", () => {
    const key = issuePhotoKey(SECRET, PLACE, ALICE, "webp");
    expect(keyIssuedTo(`${SECRET}-rotated`, key, PLACE, ALICE)).toBe(false);
  });
});

describe("looksLike", () => {
  const bytes = (...values: number[]) => new Uint8Array(values);

  test("recognises the three accepted formats", () => {
    expect(looksLike("jpg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(
      looksLike("png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe(true);
    expect(
      looksLike(
        "webp",
        bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe(true);
  });

  test("rejects a file whose bytes do not match its name", () => {
    const html = new TextEncoder().encode("<html><body>");
    expect(looksLike("jpg", html)).toBe(false);
    expect(looksLike("png", bytes(0xff, 0xd8, 0xff))).toBe(false);
    expect(looksLike("webp", bytes(0x52, 0x49, 0x46, 0x46))).toBe(false);
    expect(looksLike("gif", bytes(0x47, 0x49, 0x46))).toBe(false);
  });
});
