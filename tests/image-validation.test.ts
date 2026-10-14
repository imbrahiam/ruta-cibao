import { expect, test } from "bun:test";
import sharp from "sharp";
import { normalizePhoto } from "@/lib/image";

test("an image header alone cannot pass document validation", async () => {
  await expect(
    normalizePhoto(new Uint8Array([255, 216, 255, 0, 0])),
  ).rejects.toThrow();
});
test("accepted images are resized and metadata removed", async () => {
  const original = await sharp({
    create: { width: 1800, height: 20, channels: 3, background: "white" },
  })
    .withExif({ IFD0: { Artist: "Private identity" } })
    .jpeg()
    .toBuffer();
  const output = await normalizePhoto(original);
  const metadata = await sharp(output).metadata();
  expect(metadata.width).toBe(1600);
  expect(metadata.format).toBe("webp");
  expect(metadata.exif).toBeUndefined();
});
