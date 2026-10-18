/**
 * Captures the screenshots the web app manifest offers.
 *
 * Chrome on Android shows a richer install sheet — a gallery of the app, not
 * just its name and icon — when the manifest lists `screenshots` with
 * `form_factor: "narrow"`. They have to be real captures of the real app, so
 * this drives a browser against a running instance rather than shipping
 * mock-ups that would go stale.
 *
 *   bunx playwright install chromium        # once
 *   bun run screenshots                     # against http://localhost:3000
 *   SCREENSHOT_BASE_URL=https://staging.example.do bun run screenshots
 *   SCREENSHOT_CHANNEL=chrome bun run screenshots   # the vector map, via GPU
 *
 * Writes `public/screenshots/*.png`. `src/app/manifest.ts` lists whichever of
 * them exist at build time, so the next build carries them.
 */
import { mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT = "public/screenshots";

/** The phone frame: 390×844 CSS pixels at 3×, a common modern Android/iPhone. */
const VIEWPORT = { width: 390, height: 844 };
const SCALE = 3;

const SHOTS = [
  { name: "map", path: "/mapa", settle: 4000 },
  { name: "explore", path: "/explorar", settle: 1500 },
  { name: "consultations", path: "/consultas", settle: 1500 },
] as const;

mkdirSync(OUT, { recursive: true });

// The bundled headless shell draws the MapLibre map with SwiftShader, which
// is slow but correct. `SCREENSHOT_CHANNEL=chrome` drives the installed
// Chrome with its GPU instead.
const browser = await chromium.launch({
  channel: process.env.SCREENSHOT_CHANNEL,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: SCALE,
  isMobile: true,
  hasTouch: true,
  locale: "es-DO",
  // Keeps the install card and other first-visit offers out of the picture.
  storageState: {
    cookies: [],
    origins: [
      {
        origin: new URL(BASE).origin,
        localStorage: [
          {
            name: "ruta-cibao:install-snoozed-until",
            value: String(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    ],
  },
});

for (const shot of SHOTS) {
  const page = await context.newPage();
  await page.goto(new URL(shot.path, BASE).toString(), {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(shot.settle);
  const file = `${OUT}/${shot.name}.png`;
  await page.screenshot({ path: file });
  console.log(`wrote ${file}`);
  await page.close();
}

await browser.close();
