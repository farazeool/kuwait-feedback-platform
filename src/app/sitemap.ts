import type { MetadataRoute } from "next";

import { getMarketingUrl } from "@/lib/config/domains";

/**
 * sitemap.xml — public marketing surface only.
 *
 * Operational routes are intentionally absent: they live on the InstaView
 * hostname, are behind authentication, and carry noindex metadata.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMarketingUrl();
  const lastModified = new Date();

  return [
    { url: `${base}/`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
