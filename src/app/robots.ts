import type { MetadataRoute } from "next";

import { getMarketingUrl } from "@/lib/config/domains";

/**
 * robots.txt
 *
 * Operational areas are disallowed from crawling, while the public feedback
 * entry points are left crawlable-but-unindexed by their own page metadata:
 * blocking them here would not stop a customer opening a QR link, but it also
 * gains nothing, so they are simply excluded from the disallow list rather than
 * being advertised.
 *
 * Note this file is served from both hostnames. The disallow list is written to
 * be correct in both cases — on the marketing host these paths redirect to
 * InstaView anyway, and on InstaView they are genuinely private.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/reset-password",
          "/auth/",
          "/dashboard",
          "/dashboard/",
          "/onboarding",
          "/kiosk/activate",
          "/kiosk/device",
        ],
      },
    ],
    sitemap: `${getMarketingUrl()}/sitemap.xml`,
    host: getMarketingUrl(),
  };
}
