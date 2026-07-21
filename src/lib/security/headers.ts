export type SecurityHeader = { key: string; value: string };

export function buildSecurityHeaders(environment = process.env.APP_ENV ?? "local"): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        `script-src 'self' 'unsafe-inline'${environment === "production" ? "" : " 'unsafe-eval'"}`,
        "connect-src 'self' https: wss:",
      ].join("; "),
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-site" },
    { key: "Origin-Agent-Cluster", value: "?1" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];

  if (environment === "production") {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" });
  }
  return headers;
}
