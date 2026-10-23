import type { MetadataRoute } from "next";
import { site } from "@/lib/web/site";

/** The public pages are open to search; the staff desk and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/s/"] },
    sitemap: `${site.origin}/sitemap.xml`,
  };
}
