import { existsSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import messages from "../../messages/es.json";

/**
 * The captures `bun run screenshots` writes, in the order the install sheet
 * shows them. Listed only when the file is there, so a fresh checkout builds
 * a valid manifest; Chrome then falls back to its plain install dialog.
 */
const SCREENSHOTS = [
  { file: "map", label: messages.navigation.map },
  { file: "explore", label: messages.navigation.explore },
  { file: "consultations", label: messages.navigation.consultations },
].filter(({ file }) =>
  existsSync(join(process.cwd(), "public", "screenshots", `${file}.png`)),
);

/**
 * Installable on a phone's home screen.
 *
 * `standalone` so it opens without browser chrome — on a small screen that is
 * a whole row of pixels back for the map. Portrait only: this is used
 * one-handed, walking.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ruta Cibao",
    short_name: "Ruta Cibao",
    description: messages.app.tagline,
    id: "/",
    scope: "/",
    start_url: "/mapa",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#213d34",
    lang: "es-DO",
    dir: "ltr",
    categories: ["travel", "navigation", "government"],
    shortcuts: [
      {
        name: messages.map.actions.reportTraffic,
        url: "/mapa?reportar=transito",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: messages.navigation.explore,
        url: "/explorar",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: messages.navigation.contributions,
        url: "/aportes",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    screenshots: SCREENSHOTS.map(({ file, label }) => ({
      src: `/screenshots/${file}.png`,
      sizes: "1170x2532",
      type: "image/png",
      form_factor: "narrow" as const,
      label,
    })),
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
