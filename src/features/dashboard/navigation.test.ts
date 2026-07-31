import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DASHBOARD_NAVIGATION, navigationForRole } from "./navigation";

/**
 * Every route under src/app that renders a page, with Next.js route groups --
 * the "(dashboard)" style segments -- dropped, since they organise files
 * without contributing to the URL.
 */
function routesWithPages(dir: string, segments: string[] = []): string[] {
  const routes: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const isRouteGroup = entry.name.startsWith("(") && entry.name.endsWith(")");
      routes.push(...routesWithPages(join(dir, entry.name), isRouteGroup ? segments : [...segments, entry.name]));
    } else if (entry.name === "page.tsx") {
      routes.push(`/${segments.join("/")}`);
    }
  }

  return routes;
}

describe("role-aware dashboard navigation", () => {
  it("keeps team visibility read-only while hiding settings from scoped roles", () => {
    expect(navigationForRole("analyst").map((item) => item.label)).toContain("nav.team");
    expect(navigationForRole("location_manager").map((item) => item.label)).not.toContain("nav.settings");
  });

  it("shows tenant management to owners and organization admins", () => {
    expect(navigationForRole("organization_owner").map((item) => item.label)).toContain("nav.team");
    expect(navigationForRole("organization_admin").map((item) => item.label)).toContain("nav.settings");
  });

  it("offers kiosks to exactly the roles requireOrganizationManagementContext admits", () => {
    // The page guard redirects everyone else to /dashboard, so linking them
    // there would advertise a dead end.
    for (const role of ["organization_owner", "organization_admin", "quality_manager", "senior_management"] as const) {
      expect(navigationForRole(role).map((item) => item.href)).toContain("/dashboard/kiosks");
    }

    for (const role of ["analyst", "location_manager"] as const) {
      expect(navigationForRole(role).map((item) => item.href)).not.toContain("/dashboard/kiosks");
    }
  });

  it("only links to routes that render a page", () => {
    const routes = routesWithPages(join(process.cwd(), "src", "app"));

    for (const item of DASHBOARD_NAVIGATION) {
      expect(routes, `${item.href} has no page.tsx`).toContain(item.href);
    }
  });
});
