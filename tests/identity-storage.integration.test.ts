import { afterAll, describe, expect, test } from "bun:test";
import sharp from "sharp";
import { getObjectBytes, statObject } from "@/lib/storage";
import {
  purgeDocuments,
  readDocument,
  storeDocument,
} from "@/modules/identity/documents";

// Explicit opt-in; use a private test bucket and invented image data only.
describe.skipIf(process.env.RUN_STORAGE_TESTS !== "1")(
  "identity evidence storage",
  () => {
    const key = `identity-test/${crypto.randomUUID()}.bin`;
    afterAll(async () => {
      await purgeDocuments([key]);
    });
    test("stores ciphertext, reads normalized evidence, and deletes it", async () => {
      const image = await sharp({
        create: {
          width: 2000,
          height: 1000,
          channels: 3,
          background: "#234567",
        },
      })
        .jpeg()
        .toBuffer();
      await storeDocument(key, image);
      const ciphertext = await getObjectBytes(key);
      expect(Buffer.from(ciphertext).equals(image)).toBe(false);
      await expect(sharp(ciphertext).metadata()).rejects.toThrow();
      const metadata = await sharp(await readDocument(key)).metadata();
      expect(metadata.format).toBe("webp");
      expect(metadata.width).toBe(1600);
      expect(metadata.exif).toBeUndefined();
      await purgeDocuments([key]);
      expect(await statObject(key)).toBeNull();
    });
  },
);
