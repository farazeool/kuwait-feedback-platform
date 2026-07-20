import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/(.*)", headers: buildSecurityHeaders() }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
