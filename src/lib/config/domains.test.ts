import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildAuthCallbackUrl,
  buildDashboardUrl,
  buildKioskActivationUrl,
  buildLoginUrl,
  buildPasswordResetUrl,
  buildRatingUrl,
  buildSurveyUrl,
  classifyHost,
  getAppUrl,
  getMarketingUrl,
  isAppOnlyPath,
  isNeverRedirectPath,
  resolveAppRootDestination,
  resolveMarketingRedirect,
} from "@/lib/config/domains";

const APP = "https://instaview.reviewandmore.tech";
const MARKETING = "https://www.reviewandmore.tech";

describe("domain configuration", () => {
  const original = { app: process.env.NEXT_PUBLIC_APP_URL, marketing: process.env.NEXT_PUBLIC_MARKETING_URL };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP;
    process.env.NEXT_PUBLIC_MARKETING_URL = MARKETING;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = original.app;
    process.env.NEXT_PUBLIC_MARKETING_URL = original.marketing;
  });

  describe("base URLs", () => {
    it("reads both hostnames from the environment", () => {
      expect(getAppUrl()).toBe(APP);
      expect(getMarketingUrl()).toBe(MARKETING);
    });

    it("normalizes a trailing slash so joins never double up", () => {
      process.env.NEXT_PUBLIC_APP_URL = `${APP}/`;
      expect(getAppUrl()).toBe(APP);
      expect(buildLoginUrl()).toBe(`${APP}/login`);
    });

    it("falls back to the application URL when no marketing host is configured", () => {
      delete process.env.NEXT_PUBLIC_MARKETING_URL;
      expect(getMarketingUrl()).toBe(APP);
    });

    it("keeps localhost usable with no environment configuration at all", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_MARKETING_URL;
      expect(getAppUrl()).toBe("http://localhost:3000");
      expect(buildLoginUrl()).toBe("http://localhost:3000/login");
    });
  });

  describe("generated absolute URLs", () => {
    it("points every authentication flow at the InstaView host", () => {
      expect(buildLoginUrl()).toBe(`${APP}/login`);
      expect(buildDashboardUrl()).toBe(`${APP}/dashboard`);
      expect(buildAuthCallbackUrl()).toBe(`${APP}/auth/callback`);
      expect(buildPasswordResetUrl()).toBe(`${APP}/auth/callback?next=%2Freset-password`);
    });

    it("preserves a deep link through login", () => {
      expect(buildLoginUrl("/dashboard/kiosks")).toBe(`${APP}/login?next=%2Fdashboard%2Fkiosks`);
    });

    it("builds device, rating and survey URLs on the application host", () => {
      expect(buildKioskActivationUrl("ABC123")).toBe(`${APP}/kiosk/activate?code=ABC123`);
      expect(buildRatingUrl("opaque-token")).toBe(`${APP}/f/opaque-token`);
      expect(buildSurveyUrl("central-branch")).toBe(`${APP}/feedback/central-branch`);
    });

    it("encodes untrusted values instead of interpolating them raw", () => {
      expect(buildKioskActivationUrl("a b&c")).toBe(`${APP}/kiosk/activate?code=a%20b%26c`);
      expect(buildRatingUrl("a/b?c")).toBe(`${APP}/f/a%2Fb%3Fc`);
      expect(buildSurveyUrl("survey slug")).toBe(`${APP}/feedback/survey%20slug`);
    });

    it("never emits a marketing URL for an operational flow", () => {
      for (const url of [buildLoginUrl(), buildDashboardUrl(), buildAuthCallbackUrl(), buildPasswordResetUrl(), buildRatingUrl("t"), buildSurveyUrl("s")]) {
        expect(url.startsWith(APP)).toBe(true);
        expect(url).not.toContain("www.reviewandmore.tech");
      }
    });
  });

  describe("host classification", () => {
    it("recognizes the two production hostnames", () => {
      expect(classifyHost("www.reviewandmore.tech")).toBe("marketing");
      expect(classifyHost("instaview.reviewandmore.tech")).toBe("app");
    });

    it("ignores port and letter case", () => {
      expect(classifyHost("WWW.ReviewAndMore.Tech:443")).toBe("marketing");
      expect(classifyHost("localhost:3000")).toBe("local");
    });

    it("fails safe for unknown and missing hosts by serving the guarded application", () => {
      expect(classifyHost("kuwait-feedback-platform.vercel.app")).toBe("app");
      expect(classifyHost("reviewandmore.tech")).toBe("app");
      expect(classifyHost("attacker.example")).toBe("app");
      expect(classifyHost(null)).toBe("app");
      expect(classifyHost("")).toBe("app");
    });
  });

  describe("path classification", () => {
    it("treats operational trees as application-only", () => {
      for (const path of ["/login", "/dashboard", "/dashboard/kiosks", "/onboarding", "/platform", "/invite/abc", "/reset-password", "/kiosk/device"]) {
        expect(isAppOnlyPath(path)).toBe(true);
      }
    });

    it("does not claim marketing paths", () => {
      for (const path of ["/", "/privacy", "/terms", "/security"]) {
        expect(isAppOnlyPath(path)).toBe(false);
      }
    });

    it("protects framework, API, and public collection routes from interception", () => {
      for (const path of ["/_next/static/chunk.js", "/api/feedback", "/api/kiosk/heartbeat", "/f/token", "/feedback/slug", "/robots.txt", "/sitemap.xml", "/favicon.ico"]) {
        expect(isNeverRedirectPath(path)).toBe(true);
      }
    });

    it("does not treat a lookalike prefix as protected", () => {
      expect(isNeverRedirectPath("/apiary")).toBe(false);
      expect(isAppOnlyPath("/loginhelp")).toBe(false);
    });
  });

  describe("marketing host redirect resolution", () => {
    it("serves the marketing homepage and legal pages in place", () => {
      expect(resolveMarketingRedirect("/")).toBeNull();
      expect(resolveMarketingRedirect("/privacy")).toBeNull();
      expect(resolveMarketingRedirect("/terms")).toBeNull();
    });

    it("hands the login route to InstaView", () => {
      expect(resolveMarketingRedirect("/login")).toBe(`${APP}/login`);
    });

    it("hands the dashboard to InstaView", () => {
      expect(resolveMarketingRedirect("/dashboard")).toBe(`${APP}/dashboard`);
      expect(resolveMarketingRedirect("/dashboard/reports")).toBe(`${APP}/dashboard/reports`);
    });

    it("preserves the query string across the hostname hop", () => {
      expect(resolveMarketingRedirect("/login", "?next=%2Fdashboard&lang=ar")).toBe(`${APP}/login?next=%2Fdashboard&lang=ar`);
      expect(resolveMarketingRedirect("/kiosk/activate", "?code=ABC123")).toBe(`${APP}/kiosk/activate?code=ABC123`);
    });

    it("never redirects API routes, auth callbacks, or public collection routes", () => {
      expect(resolveMarketingRedirect("/api/feedback")).toBeNull();
      expect(resolveMarketingRedirect("/api/kiosk/heartbeat")).toBeNull();
      expect(resolveMarketingRedirect("/f/opaque-token")).toBeNull();
      expect(resolveMarketingRedirect("/feedback/central-branch")).toBeNull();
      expect(resolveMarketingRedirect("/_next/static/app.js")).toBeNull();
    });

    it("cannot produce a redirect loop, because every destination leaves the marketing host", () => {
      for (const path of ["/login", "/dashboard", "/onboarding", "/platform", "/kiosk/device"]) {
        const destination = resolveMarketingRedirect(path);
        expect(destination).not.toBeNull();
        expect(destination!.startsWith(APP)).toBe(true);
        expect(destination).not.toContain(MARKETING);
      }
    });
  });

  describe("InstaView root handling", () => {
    it("hands the workspace root to the dashboard, whose guard decides what to show", () => {
      // The dashboard's existing server-side guard then routes a signed-out
      // visitor to /login and a user without an organization to onboarding,
      // so the edge never has to read a session.
      expect(resolveAppRootDestination("app", "/")).toBe("/dashboard");
    });

    it("serves the marketing homepage in place on the public brand host", () => {
      expect(resolveAppRootDestination("marketing", "/")).toBeNull();
    });

    it("keeps localhost on the marketing homepage so local dev needs no DNS changes", () => {
      expect(resolveAppRootDestination("local", "/")).toBeNull();
    });

    it("only ever acts on the root path", () => {
      for (const pathname of ["/login", "/dashboard", "/kiosk/device", "/f/token", "/privacy", "/api/feedback"]) {
        expect(resolveAppRootDestination("app", pathname)).toBeNull();
      }
    });

    it("cannot loop, because the destination is never the root it came from", () => {
      const destination = resolveAppRootDestination("app", "/");
      expect(destination).not.toBe("/");
      expect(resolveAppRootDestination("app", destination as string)).toBeNull();
    });

    it("stays on the current origin by returning a relative path", () => {
      expect(resolveAppRootDestination("app", "/")).not.toContain("://");
    });
  });
});
