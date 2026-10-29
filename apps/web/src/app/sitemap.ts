import type { MetadataRoute } from "next";
import { site } from "@/lib/web/site";

const PATHS = [
  "/",
  "/experience",
  "/download",
  "/territory",
  "/privacy",
  "/terms",
  "/support",
  "/account/delete",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${site.origin}${path}` }));
}
