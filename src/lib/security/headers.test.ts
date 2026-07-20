import { describe, expect, it } from "vitest";

import { buildSecurityHeaders } from "./headers";

describe("production security headers", () => {
  it("sets browser hardening headers", () => {
    const headers = Object.fromEntries(buildSecurityHeaders("preview").map(({ key, value }) => [key, value]));
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toBeUndefined();
  });

  it("sets HSTS only in production", () => {
    const headers = Object.fromEntries(buildSecurityHeaders("production").map(({ key, value }) => [key, value]));
    expect(headers["Strict-Transport-Security"]).toContain("includeSubDomains");
  });
});
