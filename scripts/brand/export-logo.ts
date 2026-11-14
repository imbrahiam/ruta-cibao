import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../../brand/logo/", import.meta.url));
// The mark: a bright green circle with one near-black green glyph, two roads
// merging; the wordmark is ink.
const green = "#00D66F";
const ink = "#011E0F";
const text = "#0F1419";
type Point = { x: number; y: number };

// The construction starts from Link's mark (measured from its 1200×630 social
// image: circle centre 599.5,314.5, radius 200.5; edges fitted as circular
// arcs) and departs from it on purpose, so it is ours: the two arms are about
// 13% heavier (a smaller inner arc), they run on until they meet the circle
// instead of stopping at a level cut, and where they merge the road ends in a
// round cap instead of a plumb cut. The lower arm mirrors the upper one.
const source = { cx: 599.5, cy: 314.5, r: 200.5 };
const outerArc = { cx: 720.4622, cy: 142.4089, r: 199.5663 };
const innerArc = { cx: 727.1287, cy: 148.2313, r: 136.4152 };
const topCut = 193.5;
const rightCut = 700.5;
const scale = 512 / source.r;
const toMark = (p: Point): Point => ({
  x: 512 + (p.x - source.cx) * scale,
  y: 512 + (p.y - source.cy) * scale,
});
const mirror = (p: Point): Point => ({ x: p.x, y: 2 * source.cy - p.y });
type Arc = { cx: number; cy: number; r: number };
const onArc = (arc: Arc, angle: number): Point => ({
  x: arc.cx + arc.r * Math.cos(angle),
  y: arc.cy + arc.r * Math.sin(angle),
});
/** The angle (on the arc's left half) where the arc crosses a level line. */
const angleAtY = (arc: Arc, y: number) =>
  Math.PI - Math.asin((y - arc.cy) / arc.r);
/** The angle where the arc crosses a plumb line, on its lower half. */
const angleAtX = (arc: Arc, x: number) => Math.acos((x - arc.cx) / arc.r);
const sweep = (arc: Arc, from: number, to: number, steps = 160) =>
  Array.from({ length: steps + 1 }, (_, i) =>
    onArc(arc, from + ((to - from) * i) / steps),
  );

// Upper arm, image coordinates: outer edge from the top cut down to where the
// two outer arcs meet (the notch on the left), inner edge from the plumb cut
// back up to the top cut.
const outerTop = angleAtY(outerArc, topCut);
const outerNotch = angleAtY(outerArc, source.cy);
const innerTop = angleAtY(innerArc, topCut);
const innerCut = angleAtX(innerArc, rightCut);
// The two lined arms run on past Link's level cut until they meet the circle,
// and end along its edge; the plumb cut on the right stays where it is.
const outside = (p: Point) =>
  Math.hypot(p.x - source.cx, p.y - source.cy) - source.r;
const exitAngle = (arc: Arc, from: number) => {
  let inside = from;
  let beyond = from + 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (inside + beyond) / 2;
    if (outside(onArc(arc, mid)) < 0) inside = mid;
    else beyond = mid;
  }
  return inside;
};
const outerExit = exitAngle(outerArc, outerTop);
const innerExit = exitAngle(innerArc, innerTop);
/** The circle's own edge between two points on it, the short way round. */
const rim = (from: Point, to: Point, steps = 24) => {
  const a = Math.atan2(from.y - source.cy, from.x - source.cx);
  let b = Math.atan2(to.y - source.cy, to.x - source.cx);
  if (b - a > Math.PI) b -= 2 * Math.PI;
  if (a - b > Math.PI) b += 2 * Math.PI;
  return Array.from({ length: steps - 1 }, (_, i) =>
    onArc(source, a + ((b - a) * (i + 1)) / steps),
  );
};
const upperOuter = sweep(outerArc, outerExit, outerNotch);
const upperInner = sweep(innerArc, innerCut, innerExit);
const topOuterEnd = upperOuter[0] as Point;
const topInnerEnd = upperInner[upperInner.length - 1] as Point;
/** The round cap where the arms merge: a half circle from the lower arm's inner edge to the upper's. */
const cap = (() => {
  const top = upperInner[0] as Point;
  const radius = source.cy - top.y;
  return Array.from({ length: 31 }, (_, i) => {
    const angle = Math.PI / 2 - (Math.PI * i) / 30;
    return {
      x: rightCut + radius * Math.cos(angle),
      y: source.cy + radius * Math.sin(angle),
    };
  });
})();
const glyphOutline = [
  ...upperOuter,
  ...upperOuter.slice(0, -1).reverse().map(mirror),
  ...rim(mirror(topOuterEnd), mirror(topInnerEnd)),
  ...upperInner.slice().reverse().map(mirror),
  ...cap.slice(1, -1),
  ...upperInner,
  ...rim(topInnerEnd, topOuterEnd),
].map(toMark);
const pathOf = (points: Point[]) =>
  `M${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join("L")}Z`;
const road = pathOf(glyphOutline);

const circle = '<circle cx="512" cy="512" r="512"/>';
const glyph = (asphalt = ink) => `<path fill="${asphalt}" d="${road}"/>`;
const svg = (body: string, width = 1024, height = width) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Ruta Cibao">${body}</svg>\n`;
const markBody = (background = green, asphalt = ink) =>
  `<g fill="${background}">${circle}</g>${glyph(asphalt)}`;
const knockout = (color: string) =>
  `<defs><mask id="road" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="white"/><path fill="black" d="${road}"/></mask></defs><g fill="${color}" mask="url(#road)">${circle}</g>`;
const silhouette = (color: string) => `<path fill="${color}" d="${road}"/>`;
const save = async (name: string, content: string | Buffer) =>
  writeFile(path.join(root, name), content);
const png = async (
  name: string,
  source: string,
  width: number,
  background?: string,
) => {
  let output = sharp(Buffer.from(source)).resize({ width });
  if (background) output = output.flatten({ background }).removeAlpha();
  await output.png().toFile(path.join(root, name));
};
for (const folder of ["ios", "android", "web"])
  await mkdir(path.join(root, folder), { recursive: true });
const mark = svg(markBody());
await save("mark.svg", mark);
await save("mark-mono.svg", svg(knockout("#000")));
await save("mark-white.svg", svg(knockout("#fff")));
await save("streets.svg", svg(glyph()));
const word = await readFile(path.join(root, "wordmark.svg"), "utf8");
const viewBox = word.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
if (!viewBox)
  throw new Error("The outlined wordmark must have a numeric viewBox");
const wordWidth = Number(viewBox[1]);
const wordHeight = Number(viewBox[2]);
const wordBody = word.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const wordScale = 620 / wordHeight;
const lockupWidth = Math.ceil(1200 + wordWidth * wordScale + 24);
// The green mark reads on both light and dark; only the wordmark changes colour.
const lockupBody = (color: string) =>
  `${markBody()}<g fill="${color}" transform="translate(1200 202) scale(${wordScale})">${wordBody}</g>`;
const lockup = svg(lockupBody(text), lockupWidth, 1024);
await save("lockup.svg", lockup);
await save("lockup-dark.svg", svg(lockupBody("#fff"), lockupWidth, 1024));
for (const size of [1024, 512, 192, 48, 32, 16])
  await png(`mark-${size}.png`, mark, size);
await png("lockup-2000w.png", lockup, 2000);
// Native square canvases keep the same generous inset as the circular badge.
const app = svg(`<rect width="1024" height="1024" fill="${green}"/>${glyph()}`);
await save("ios/app-icon-source.svg", app);
await png("ios/AppIcon-1024.png", app, 1024, green);
await png("ios/AppIcon-1024-dark.png", svg(glyph(green)), 1024, ink);
await png("ios/AppIcon-1024-tinted.png", svg(glyph("#636363")), 1024);
await png("android/play-store-512.png", app, 512, green);
const vector = (size: number, offset: number, scale: number, body: string) =>
  `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="${size}dp" android:height="${size}dp" android:viewportWidth="${size}" android:viewportHeight="${size}"><group android:translateX="${offset}" android:translateY="${offset}" android:scaleX="${scale}" android:scaleY="${scale}">${body}</group></vector>\n`;
const androidGlyph = `<path android:fillColor="${ink}" android:pathData="${road}"/>`;
const androidSilhouette = `<path android:fillColor="#FFFFFF" android:pathData="${road}"/>`;
// The entire 1024-unit canvas maps to the 66 dp safe circle; glyph fits inside it.
await save(
  "android/ic_launcher_foreground.xml",
  vector(108, 21, 66 / 1024, androidGlyph),
);
await save(
  "android/ic_launcher_monochrome.xml",
  vector(108, 21, 66 / 1024, androidSilhouette),
);
// Scale actual glyph height to 20 dp; keep centreline transparent for system tint.
await save(
  "android/ic_notification.xml",
  vector(24, -4, 20 / 640, androidSilhouette),
);
await save(
  "android/colors.xml",
  `<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">${green}</color></resources>\n`,
);
await save("web/icon.svg", mark);
await png("web/apple-icon.png", app, 180, green);
for (const size of [32, 16]) await png(`web/favicon-${size}.png`, mark, size);
const ogScale = 880 / lockupWidth;
await png(
  "web/og-1200x630.png",
  svg(
    `<rect width="1200" height="630" fill="white"/><g transform="translate(160 ${(630 - 1024 * ogScale) / 2}) scale(${ogScale})">${lockupBody(text)}</g>`,
    1200,
    630,
  ),
  1200,
  "#fff",
);
// SVG equivalents let the review sheet display the exact Android paths.
await save(
  "android/foreground-preview.svg",
  svg(
    `<rect width="108" height="108" fill="${green}"/><g transform="translate(21 21) scale(${66 / 1024})">${glyph()}</g>`,
    108,
  ),
);
await save(
  "android/monochrome-preview.svg",
  svg(
    `<g transform="translate(21 21) scale(${66 / 1024})">${silhouette("#fff")}</g>`,
    108,
  ),
);
await save(
  "android/notification-preview.svg",
  svg(
    `<g transform="translate(-4 -4) scale(${20 / 640})">${silhouette("#fff")}</g>`,
    24,
  ),
);

const figure = (file: string, width: number, label = file) =>
  `<figure><a href="${file}"><img src="${file}" width="${width}" alt="${label}"></a><figcaption>${label}</figcaption></figure>`;
const assets = [
  ["mark.svg", 96],
  ["mark-mono.svg", 96],
  ["mark-white.svg", 96],
  ["streets.svg", 96],
  ["wordmark.svg", 220],
  ...[16, 32, 48, 192, 512, 1024].map<[string, number]>((size) => [
    `mark-${size}.png`,
    Math.min(size, 192),
  ]),
  ["lockup.svg", 560],
  ["lockup-dark.svg", 560],
  ["lockup-2000w.png", 560],
  ["ios/app-icon-source.svg", 96],
  ["ios/AppIcon-1024.png", 96],
  ["ios/AppIcon-1024-dark.png", 96],
  ["ios/AppIcon-1024-tinted.png", 96],
  ["android/foreground-preview.svg", 108],
  ["android/monochrome-preview.svg", 108],
  ["android/notification-preview.svg", 24],
  ["android/play-store-512.png", 96],
  ["web/icon.svg", 32],
  ["web/apple-icon.png", 180],
  ["web/favicon-32.png", 32],
  ["web/favicon-16.png", 16],
  ["web/og-1200x630.png", 560],
] satisfies [string, number][];
const panel = (dark: boolean) =>
  `<section class="${dark ? "dark" : "light"}"><h2>Fondo ${dark ? "oscuro" : "claro"}</h2><h3>16 / 32 / 48 px · tamaño real</h3><div class="row">${[16, 32, 48].map((n) => figure(`mark-${n}.png`, n, `${n} px`)).join("")}</div><h3>Variantes y exportaciones</h3><div class="row">${assets.map(([file, width]) => figure(file, width)).join("")}</div><p>Android: vistas SVG de las mismas rutas de los XML. Fondo azul independiente.</p><p><a href="android/ic_launcher_foreground.xml">Foreground XML</a> · <a href="android/ic_launcher_monochrome.xml">Monocromo XML</a> · <a href="android/ic_notification.xml">Notificación XML</a> · <a href="android/colors.xml">Color XML</a></p></section>`;
await save(
  "preview.html",
  `<!doctype html><html lang="es-DO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ruta Cibao · Carretera</title><style>
*{box-sizing:border-box}body{margin:0;padding:24px;background:#eff3f4;color:#0f1419;font:14px/1.5 system-ui,sans-serif}h1{margin:0;font-size:28px}h2{margin:0 0 20px}h3{font-size:15px;margin:24px 0 8px}.panels{display:grid;grid-template-columns:1fr 1fr;gap:20px}section{padding:24px;min-width:0;border-radius:16px}.light{background:white}.dark{background:#0f1419;color:white}.row{display:flex;align-items:center;flex-wrap:wrap;gap:20px}figure{margin:12px 0;max-width:100%}img{display:block;height:auto;max-width:100%}figcaption{font:11px/1.4 ui-monospace,monospace;margin-top:8px;overflow-wrap:anywhere;max-width:190px}a{color:inherit}.concepts{display:flex;gap:16px}.concepts figure{flex:1}.native{overflow:auto}.native img{max-width:none}.native figure{max-width:none}summary{cursor:pointer;padding:20px 0}footer{padding:20px 0}@media(max-width:800px){.panels{grid-template-columns:1fr}}
</style></head><body><h1>ruta cibao · dos calles que se unen</h1><p>Círculo verde #00D66F · glifo #011E0F · dos calles que se unen, brazos hasta el borde, punta redonda<br>16/32 px: línea continua. Desde 48 px: tres trazos. Sin líneas de borde.</p><main class="panels">${panel(false)}${panel(true)}</main><h2 style="margin-top:28px">Exploración · ronda dos</h2><div class="concepts">${[1, 2, 3, 4].map((n) => figure(`concepts-v2/0${n}.png`, 320, `0${n}${n === 1 ? " · elegido" : ""}`)).join("")}</div><p>Los PNG grandes y los lockups se reducen en esta hoja; cada enlace abre el original. Los iconos pequeños, Apple de 180 px y Android de 108/24 px se muestran a tamaño real.</p><details><summary>Todos los archivos a tamaño real · desplaza para revisar cada píxel</summary><div class="panels">${[false, true].map((dark) => `<section class="${dark ? "dark" : "light"} native">${assets.map(([file]) => `<figure><img src="${file}" alt="${file}"><figcaption>${file} · tamaño nativo</figcaption></figure>`).join("")}</section>`).join("")}</div></details><footer>Outfit ExtraBold · letras originales convertidas a trazados · <a href="README.md">Documentación</a>. Pendiente de aprobación e integración.</footer></body></html>`,
);
