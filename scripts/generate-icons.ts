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
  ];

  for (const target of targets) {
    const png = await sharp(square(target.padding))
      .resize(target.size, target.size)
      .png()
      .toBuffer();
    await writeFile(target.file, png);
    console.log(`${target.file} (${target.size}x${target.size})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
