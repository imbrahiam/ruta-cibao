import type { MetadataRoute } from "next";

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
    description: "Mapa cívico de la provincia Santiago Rodríguez",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es-DO",
    dir: "ltr",
    categories: ["travel", "navigation", "government"],
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
