/**
 * Generates the PWA icons from one SVG.
 *
 * Placeholders until there is a real mark: a manifest pointing at missing files
 * fails installation outright, so something correct beats nothing. Re-run after
 * replacing the SVG.
 *
 * The maskable variant carries extra padding because Android crops icons to
 * whatever shape the launcher uses; without it the mark loses its edges.
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const GREEN = "#166534";

function square(padding: number): Buffer {
  const inset = 512 * padding;
  const size = 512 - inset * 2;

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${GREEN}"/>
      <g transform="translate(${inset} ${inset}) scale(${size / 512})">
        <path d="M256 96c-53 0-96 43-96 96 0 72 96 176 96 176s96-104 96-176c0-53-43-96-96-96zm0 132a36 36 0 1 1 0-72 36 36 0 0 1 0 72z" fill="#ffffff"/>
        <path d="M120 400h272" stroke="#ffffff" stroke-width="24" stroke-linecap="round" fill="none" opacity="0.65"/>
      </g>
    </svg>
  `);
}

async function main() {
  await mkdir("public", { recursive: true });

  const targets = [
    { file: "public/icon-192.png", size: 192, padding: 0.08 },
    { file: "public/icon-512.png", size: 512, padding: 0.08 },
    { file: "public/icon-maskable-512.png", size: 512, padding: 0.2 },
    { file: "public/apple-touch-icon.png", size: 180, padding: 0.08 },
    // Next.js file conventions: these emit the <link> tags themselves, which is
    // what stops browsers guessing at /favicon.ico and
    // /apple-touch-icon-precomposed.png and logging a 404 for each.
    { file: "src/app/icon.png", size: 512, padding: 0.08 },
    { file: "src/app/apple-icon.png", size: 180, padding: 0.08 },
  ];

  for (const target of targets) {
    const png = await sharp(square(target.padding))
      .resize(target.size, target.size)
      .png()
      .toBuffer();
    await writeFile(target.file, png);
    console.log(`${target.file} (${target.size}x${target.size})`);
  }

  // Some browsers ask for /favicon.ico whatever icons are declared. An ICO is a
  // short header followed by image data, and the format accepts a PNG payload
  // directly, so this is a real .ico rather than a renamed PNG.
  const favicon = await sharp(square(0.08)).resize(32, 32).png().toBuffer();
  await writeFile("src/app/favicon.ico", icoContainer(favicon, 32));
  console.log("src/app/favicon.ico (32x32)");
}

/** ICONDIR, one ICONDIRENTRY, then the PNG bytes. */
function icoContainer(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2); // palette size
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.byteLength, 8);
  entry.writeUInt32LE(header.byteLength + entry.byteLength, 12);

  return Buffer.concat([header, entry, png]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
