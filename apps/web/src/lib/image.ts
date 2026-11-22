import sharp from "sharp";

/** Decode and re-encode: remove metadata and reject fake or oversized images. */
export async function normalizePhoto(
  bytes: Uint8Array,
  maxSide = 1600,
): Promise<Uint8Array> {
  return sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" })
    .rotate()
    .resize({
      width: maxSide,
      height: maxSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer();
}
