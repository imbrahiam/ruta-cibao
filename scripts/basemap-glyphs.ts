/**
 * Builds the map's label glyphs from the interface's own fonts.
 *
 * MapLibre draws text from signed-distance-field glyph packs it fetches by
 * URL, not from webfonts, so labels on the map would otherwise be set in a
 * different face from every word around them. This renders Inter (400, 500,
 * 600) and Geist Mono (500) into the same PBF format the Protomaps packs use,
 * one directory per font stack under `public/fonts/`.
 *
 * Each pack covers every range the Noto Sans pack covers. Code points the
 * Genesis fonts do not have are copied from Noto, so a town name in a script
 * Inter lacks still draws instead of leaving a gap.
 *
 *   bun run basemap:fonts && bun run basemap:glyphs
 *
 * The distance field is computed exactly from the glyph outline (signed
 * distance to the flattened contours, sign from the winding number) rather
 * than estimated from a rasterised bitmap. Parameters match the Protomaps and
 * fontnik packs MapLibre is tuned for: 24px em, 3px buffer, radius 8,
 * cutoff 0.25, and `top` measured from a 25px ascent.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import opentype from "opentype.js";
import { PbfReader, PbfWriter } from "pbf";

const FONTS_DIR = "public/fonts";
const WORK = ".tooling/glyph-fonts";
const FALLBACK = "Noto Sans Regular";

const SIZE = 24;
const BUFFER = 3;
const RADIUS = 8;
const CUTOFF = 0.25;
const ASCENT = 25;

const STACKS = [
  { name: "Inter Regular", family: "Inter", weight: 400 },
  { name: "Inter Medium", family: "Inter", weight: 500 },
  { name: "Inter SemiBold", family: "Inter", weight: 600 },
  { name: "Geist Mono Medium", family: "Geist Mono", weight: 500 },
] as const;

type Glyph = {
  id: number;
  bitmap?: Uint8Array;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
};

/** Google Fonts serves TrueType to a client that does not ask for WOFF2. */
async function downloadFont(family: string, weight: number): Promise<string> {
  const file = `${WORK}/${family.replace(/\s+/g, "")}-${weight}.ttf`;
  if (existsSync(file)) return file;

  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
  ).then((response) => response.text());
  const url = /url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
  if (!url) throw new Error(`no TrueType source for ${family} ${weight}`);

  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  await mkdir(WORK, { recursive: true });
  await writeFile(file, bytes);
  return file;
}

type Point = { x: number; y: number };

/** The outline as closed polylines in pixel units, y pointing up. */
function contours(path: opentype.Path): Point[][] {
  const scale = 1;
  const result: Point[][] = [];
  let current: Point[] = [];
  let pen: Point = { x: 0, y: 0 };
  const steps = 8;

  for (const command of path.commands) {
    if (command.type === "M") {
      if (current.length) result.push(current);
      pen = { x: command.x * scale, y: -command.y * scale };
      current = [pen];
    } else if (command.type === "L") {
      pen = { x: command.x * scale, y: -command.y * scale };
      current.push(pen);
    } else if (command.type === "Q") {
      const start = pen;
      const control = { x: command.x1, y: -command.y1 };
      const end = { x: command.x, y: -command.y };
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const u = 1 - t;
        current.push({
          x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
          y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
        });
      }
      pen = end;
    } else if (command.type === "C") {
      const start = pen;
      const c1 = { x: command.x1, y: -command.y1 };
      const c2 = { x: command.x2, y: -command.y2 };
      const end = { x: command.x, y: -command.y };
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        const u = 1 - t;
        current.push({
          x:
            u * u * u * start.x +
            3 * u * u * t * c1.x +
            3 * u * t * t * c2.x +
            t * t * t * end.x,
          y:
            u * u * u * start.y +
            3 * u * u * t * c1.y +
            3 * u * t * t * c2.y +
            t * t * t * end.y,
        });
      }
      pen = end;
    } else if (command.type === "Z") {
      if (current.length) result.push(current);
      current = [];
    }
  }
  if (current.length) result.push(current);
  return result;
}

function segmentDistanceSquared(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared
    ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared
    : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + t * dx - p.x;
  const y = a.y + t * dy - p.y;
  return x * x + y * y;
}

/** Non-zero winding, the fill rule TrueType outlines are drawn with. */
function winding(p: Point, rings: Point[][]): number {
  let total = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i] as Point;
      const b = ring[(i + 1) % ring.length] as Point;
      if (a.y <= p.y) {
        if (
          b.y > p.y &&
          (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0
        )
          total++;
      } else if (
        b.y <= p.y &&
        (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0
      ) {
        total--;
      }
    }
  }
  return total;
}

function renderGlyph(font: opentype.Font, codePoint: number): Glyph | null {
  const glyph = font.charToGlyph(String.fromCodePoint(codePoint));
  if (!glyph || glyph.index === 0) return null;

  const scale = SIZE / font.unitsPerEm;
  const advance = Math.round((glyph.advanceWidth ?? 0) * scale);
  const path = glyph.getPath(0, 0, SIZE);
  const rings = contours(path).map((ring) =>
    ring.map(({ x, y }) => ({ x, y })),
  );
  const points = rings.flat();

  if (points.length === 0) {
    return {
      id: codePoint,
      width: 0,
      height: 0,
      left: 0,
      top: -ASCENT,
      advance,
    };
  }

  const xMin = Math.floor(Math.min(...points.map((p) => p.x)));
  const xMax = Math.ceil(Math.max(...points.map((p) => p.x)));
  const yMin = Math.floor(Math.min(...points.map((p) => p.y)));
  const yMax = Math.ceil(Math.max(...points.map((p) => p.y)));
  const width = xMax - xMin;
  const height = yMax - yMin;
  const columns = width + 2 * BUFFER;
  const rows = height + 2 * BUFFER;
  const bitmap = new Uint8Array(columns * rows);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const p = {
        x: xMin - BUFFER + column + 0.5,
        y: yMax + BUFFER - row - 0.5,
      };
      let nearest = Number.POSITIVE_INFINITY;
      for (const ring of rings) {
        for (let i = 0; i < ring.length; i++) {
          const d = segmentDistanceSquared(
            p,
            ring[i] as Point,
            ring[(i + 1) % ring.length] as Point,
          );
          if (d < nearest) nearest = d;
        }
      }
      const inside = winding(p, rings) !== 0;
      const distance = Math.sqrt(nearest) * (inside ? -1 : 1);
      bitmap[row * columns + column] = Math.max(
        0,
        Math.min(255, Math.round(255 - 255 * (distance / RADIUS + CUTOFF))),
      );
    }
  }

  return {
    id: codePoint,
    bitmap,
    width,
    height,
    left: xMin,
    top: yMax - ASCENT,
    advance,
  };
}

function readPack(bytes: Uint8Array): Map<number, Glyph> {
  const glyphs = new Map<number, Glyph>();
  const reader = new PbfReader(bytes);
  reader.readFields((tag, _, stack) => {
    if (tag !== 1) return;
    stack.readMessage((fieldTag, __, fields) => {
      if (fieldTag !== 3) return;
      const glyph: Glyph = {
        id: 0,
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        advance: 0,
      };
      fields.readMessage((key, ___, value) => {
        if (key === 1) glyph.id = value.readVarint();
        else if (key === 2) glyph.bitmap = value.readBytes();
        else if (key === 3) glyph.width = value.readVarint();
        else if (key === 4) glyph.height = value.readVarint();
        else if (key === 5) glyph.left = value.readSVarint();
        else if (key === 6) glyph.top = value.readSVarint();
        else if (key === 7) glyph.advance = value.readVarint();
      }, undefined);
      glyphs.set(glyph.id, glyph);
    }, undefined);
  }, undefined);
  return glyphs;
}

function writePack(name: string, range: string, glyphs: Glyph[]): Uint8Array {
  const writer = new PbfWriter();
  writer.writeMessage(
    1,
    () => {
      writer.writeStringField(1, name);
      writer.writeStringField(2, range);
      for (const glyph of glyphs) {
        writer.writeMessage(
          3,
          () => {
            writer.writeVarintField(1, glyph.id);
            if (glyph.bitmap?.length) writer.writeBytesField(2, glyph.bitmap);
            writer.writeVarintField(3, glyph.width);
            writer.writeVarintField(4, glyph.height);
            writer.writeSVarintField(5, glyph.left);
            writer.writeSVarintField(6, glyph.top);
            writer.writeVarintField(7, glyph.advance);
          },
          undefined,
        );
      }
    },
    undefined,
  );
  return writer.finish();
}

async function main() {
  const fallbackDir = `${FONTS_DIR}/${FALLBACK}`;
  if (!existsSync(fallbackDir)) {
    throw new Error(
      `${fallbackDir} is missing: run \`bun run basemap:fonts\` first`,
    );
  }
  const ranges = (await readdir(fallbackDir)).filter((file) =>
    file.endsWith(".pbf"),
  );

  for (const stack of STACKS) {
    const font = opentype.parse(
      (await readFile(await downloadFont(stack.family, stack.weight))).buffer,
    );
    const destination = `${FONTS_DIR}/${stack.name}`;
    await mkdir(destination, { recursive: true });
    let own = 0;

    for (const file of ranges) {
      const range = file.replace(".pbf", "");
      const [start, end] = range.split("-").map(Number) as [number, number];
      const fallback = readPack(await readFile(`${fallbackDir}/${file}`));
      const glyphs: Glyph[] = [];
      for (let codePoint = start; codePoint <= end; codePoint++) {
        const rendered = renderGlyph(font, codePoint);
        if (rendered) {
          glyphs.push(rendered);
          own++;
        } else {
          const borrowed = fallback.get(codePoint);
          if (borrowed) glyphs.push(borrowed);
        }
      }
      await writeFile(
        `${destination}/${file}`,
        writePack(stack.name, range, glyphs),
      );
    }
    console.log(
      `${stack.name}: ${own} glyphs of its own, ${ranges.length} ranges`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
