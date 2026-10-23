import type { MetadataRoute } from "next";
import { site } from "@/lib/web/site";

const PATHS = ["/", "/privacidad", "/terminos", "/soporte", "/cuenta/eliminar"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: `${site.origin}${path}` }));
}
