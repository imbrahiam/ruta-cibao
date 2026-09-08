import type { MetadataRoute } from "next";
import messages from "../../messages/es.json";

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
